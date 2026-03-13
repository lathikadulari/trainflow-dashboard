/*
  ============================================================
  MAKUMBURA STATION — Dual ADXL335 — ADS1115 — ESP32 Dual-Core
  SD Card Logging  +  HiveMQ Cloud MQTT (TLS)
  Station ID: MKB01
  ============================================================

  CORE ASSIGNMENT:
    Core 0 (MQTT Task) → WiFi connect, TLS MQTT publish, reconnect
    Core 1 (Main Loop) → Sensor read, SD log, serial print

  I2C WIRING (ESP32 ↔ ADS1115):
    GPIO21 SDA  →  ADS1115 SDA
    GPIO22 SCL  →  ADS1115 SCL
    3.3V        →  ADS1115 VDD
    GND         →  ADS1115 GND
    ADDR        →  GND  (I2C: 0x48)

  SPI WIRING (ESP32 ↔ SD Card):
    GPIO18  →  CS
    GPIO23  →  SCK
    GPIO5   →  MOSI
    GPIO19  →  MISO
    3.3V    →  VCC
    GND     →  GND

  ADXL335 → ADS1115 CHANNELS:
    A0 → Sensor 1 X-axis   A1 → Sensor 1 Z-axis
    A2 → Sensor 2 X-axis   A3 → Sensor 2 Z-axis

  MQTT TOPICS (Makumbura Station):
    makumbura/sensor1   → {"x_g":..., "z_g":..., "x_v":..., "z_v":...}
    makumbura/sensor2   → {"x_g":..., "z_g":..., "x_v":..., "z_v":...}
    makumbura/status    → {"sample":..., "sd":..., "wifi":..., "mqtt":...}

  LIBRARIES (Arduino Library Manager):
    → "Adafruit ADS1X15"  by Adafruit
    → "PubSubClient"      by Nick O'Leary
    → SD + SPI + WiFi + WiFiClientSecure (built-in ESP32 core)
  ============================================================
*/

#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <Adafruit_ADS1X15.h>

// ── WiFi ──────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";     // ← change to your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASS";      // ← change to your WiFi password

// ── HiveMQ Cloud MQTT (TLS port 8883) ────────────────────────────────────────
const char* MQTT_SERVER    = "8102284b29c24b4eb40e06ac182d1130.s1.eu.hivemq.cloud";
const int   MQTT_PORT      = 8883;
const char* MQTT_USER      = "dulari";
const char* MQTT_PASS      = "Dulari@123";
const char* MQTT_CLIENT_ID = "ESP32_MAKUMBURA_MKB01";

// HiveMQ Cloud uses a trusted CA — set to insecure for simplicity
// To use full cert verification, paste HiveMQ's root CA below
#define MQTT_USE_INSECURE true

// ── MQTT Topics (Makumbura Station) ───────────────────────────────────────────
const char* TOPIC_S1     = "makumbura/sensor1";
const char* TOPIC_S2     = "makumbura/sensor2";
const char* TOPIC_STATUS = "makumbura/status";

// ── I2C Pins ──────────────────────────────────────────────────────────────────
#define SDA_PIN  21
#define SCL_PIN  22

// ── SPI / SD Pins ─────────────────────────────────────────────────────────────
#define SD_CS    18
#define SD_SCK   23
#define SD_MOSI   5
#define SD_MISO  19

// ── ADS1115 ───────────────────────────────────────────────────────────────────
#define ADS_ADDRESS  0x48

// ── ADXL335 Calibration ───────────────────────────────────────────────────────
const float SUPPLY_VOLTAGE = 3.3f;
const float ZERO_G_VOLTAGE = SUPPLY_VOLTAGE / 2.0f;
const float SENSITIVITY_V  = 0.300f;

// ── Timing ────────────────────────────────────────────────────────────────────
const uint32_t SAMPLE_INTERVAL_MS   = 100;    // 10 Hz
const uint32_t SD_FLUSH_INTERVAL_MS = 1000;   // flush SD every 1 s
const uint32_t MQTT_PUBLISH_INTERVAL = 200;   // publish every 200 ms (5 Hz)
const uint32_t WIFI_RETRY_INTERVAL  = 5000;   // WiFi retry interval
const uint32_t MQTT_RETRY_INTERVAL  = 3000;   // MQTT reconnect interval
const uint8_t  SD_MAX_RETRIES       = 5;

// ── SD Buffer ─────────────────────────────────────────────────────────────────
#define BUFFER_ROWS  10
const char* LOG_FILE = "/makumbura_data.csv";

// ── Shared Data (Core 0 ↔ Core 1) ────────────────────────────────────────────
// Protected by mutex — Core 1 writes, Core 0 reads for MQTT publish
struct SensorData {
  float x_g, z_g;
  float x_voltage, z_voltage;
};

struct SharedState {
  SensorData s1;
  SensorData s2;
  uint32_t   sampleIndex;
  bool       sdReady;
  bool       dataFresh;   // true when new data is ready to publish
};

SemaphoreHandle_t dataMutex;
SharedState       shared;

// ── Globals (Core 1 owned) ────────────────────────────────────────────────────
Adafruit_ADS1115 ads;
bool     sdReady      = false;
uint8_t  sdRetryCount = 0;
uint32_t sampleIndex  = 0;
String   csvBuffer    = "";
uint8_t  bufferedRows = 0;

uint32_t lastSampleTime   = 0;
uint32_t lastFlushTime    = 0;
uint32_t lastSDRetryTime  = 0;

// ── Globals (Core 0 owned) ────────────────────────────────────────────────────
WiFiClientSecure secureClient;
PubSubClient     mqttClient(secureClient);

bool     wifiConnected = false;
bool     mqttConnected = false;
uint32_t lastWifiRetry = 0;
uint32_t lastMqttRetry = 0;
uint32_t lastPublish   = 0;

// ═════════════════════════════════════════════════════════════════════════════
// SENSOR HELPERS (Core 1)
// ═════════════════════════════════════════════════════════════════════════════
float rawToVoltage(int16_t raw) { return raw * 0.000125f; }
float voltageToG(float v)       { return (v - ZERO_G_VOLTAGE) / SENSITIVITY_V; }

SensorData readSensor(uint8_t ch_x, uint8_t ch_z) {
  SensorData d;
  d.x_voltage = rawToVoltage(ads.readADC_SingleEnded(ch_x));
  d.z_voltage = rawToVoltage(ads.readADC_SingleEnded(ch_z));
  d.x_g       = voltageToG(d.x_voltage);
  d.z_g       = voltageToG(d.z_voltage);
  return d;
}

// ═════════════════════════════════════════════════════════════════════════════
// SD HELPERS (Core 1)
// ═════════════════════════════════════════════════════════════════════════════
void printSDInfo() {
  uint8_t  t  = SD.cardType();
  uint32_t mb = (uint32_t)(SD.cardSize() / (1024 * 1024));
  Serial.print("  Card : ");
  if      (t == CARD_MMC)  Serial.println("MMC");
  else if (t == CARD_SD)   Serial.println("SDSC");
  else if (t == CARD_SDHC) Serial.println("SDHC");
  else                     Serial.println("UNKNOWN");
  Serial.print("  Size : "); Serial.print(mb); Serial.println(" MB");
}

void writeCSVHeader() {
  File f = SD.open(LOG_FILE, FILE_APPEND);
  if (!f) return;
  if (f.size() == 0) {
    f.println("sample_index,s1_x_g,s1_z_g,s1_x_v,s1_z_v,s2_x_g,s2_z_g,s2_x_v,s2_z_v");
    Serial.println("  SD: header written.");
  } else {
    Serial.print("  SD: appending (");
    Serial.print((uint32_t)f.size()); Serial.println(" bytes).");
  }
  f.close();
}

bool tryInitSD() {
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (SD.begin(SD_CS, SPI, 4000000)) {
    printSDInfo();
    writeCSVHeader();
    return true;
  }
  SD.end();
  return false;
}

void flushBufferToSD() {
  if (csvBuffer.length() == 0) return;
  File f = SD.open(LOG_FILE, FILE_APPEND);
  if (!f) { Serial.println("  SD ERROR: flush failed!"); return; }
  f.print(csvBuffer);
  f.close();
  csvBuffer    = "";
  bufferedRows = 0;
}

void bufferRow(uint32_t idx, const SensorData& s1, const SensorData& s2) {
  csvBuffer += idx;                          csvBuffer += ',';
  csvBuffer += String(s1.x_g, 4);           csvBuffer += ',';
  csvBuffer += String(s1.z_g, 4);           csvBuffer += ',';
  csvBuffer += String(s1.x_voltage, 4);     csvBuffer += ',';
  csvBuffer += String(s1.z_voltage, 4);     csvBuffer += ',';
  csvBuffer += String(s2.x_g, 4);           csvBuffer += ',';
  csvBuffer += String(s2.z_g, 4);           csvBuffer += ',';
  csvBuffer += String(s2.x_voltage, 4);     csvBuffer += ',';
  csvBuffer += String(s2.z_voltage, 4);     csvBuffer += '\n';
  bufferedRows++;
}

// ═════════════════════════════════════════════════════════════════════════════
// SERIAL PRINT (Core 1)
// ═════════════════════════════════════════════════════════════════════════════
void printReadings(uint32_t idx, const SensorData& s1, const SensorData& s2) {
  Serial.println("--------------------------------------------------");
  Serial.print("[MAKUMBURA #"); Serial.print(idx); Serial.print("]");
  Serial.print("  WiFi:"); Serial.print(wifiConnected ? "OK" : "--");
  Serial.print("  MQTT:"); Serial.println(mqttConnected ? "OK" : "--");

  Serial.print("Sensor 1 | X: "); Serial.print(s1.x_g, 3);
  Serial.print(" g (");           Serial.print(s1.x_voltage, 4);
  Serial.print(" V)   Z: ");      Serial.print(s1.z_g, 3);
  Serial.print(" g (");           Serial.print(s1.z_voltage, 4);
  Serial.println(" V)");

  Serial.print("Sensor 2 | X: "); Serial.print(s2.x_g, 3);
  Serial.print(" g (");           Serial.print(s2.x_voltage, 4);
  Serial.print(" V)   Z: ");      Serial.print(s2.z_g, 3);
  Serial.print(" g (");           Serial.print(s2.z_voltage, 4);
  Serial.println(" V)");

  if (sdReady) {
    Serial.print("SD: buf "); Serial.print(bufferedRows);
    Serial.print("/"); Serial.println(BUFFER_ROWS);
  } else {
    Serial.println("SD: not ready");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MQTT HELPERS (Core 0)
// ═════════════════════════════════════════════════════════════════════════════
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) { wifiConnected = true; return; }
  Serial.print("  [MAKUMBURA] WiFi connecting to "); Serial.print(WIFI_SSID); Serial.print(" ...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    vTaskDelay(200 / portTICK_PERIOD_MS);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print(" connected! IP: ");
    Serial.println(WiFi.localIP());
    vTaskDelay(500 / portTICK_PERIOD_MS); // Give settling time for TLS compatibility
  } else {
    wifiConnected = false;
    Serial.println(" failed. Will retry.");
  }
}

void connectMQTT() {
  if (!wifiConnected) return;
  Serial.print("  [MAKUMBURA] MQTT connecting ... ");

#if MQTT_USE_INSECURE
  secureClient.setInsecure();   // skip CA verification (simple setup)
#endif

  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(60); // Prevent TLS drop-offs

  // DYNAMIC CLIENT ID: prevents HiveMQ from kicking us out if a "ghost" session is open
  String dynamicClientId = String(MQTT_CLIENT_ID) + "_" + String(random(0xffff), HEX);

  if (mqttClient.connect(dynamicClientId.c_str(), MQTT_USER, MQTT_PASS)) {
    mqttConnected = true;
    Serial.println("connected!");
    // Publish online status
    mqttClient.publish(TOPIC_STATUS,
      "{\"status\":\"online\",\"device\":\"ESP32_MAKUMBURA_MKB01\",\"station\":\"Makumbura\"}", true);
  } else {
    mqttConnected = false;
    Serial.print("failed, rc="); Serial.println(mqttClient.state());
  }
}

void publishSensor(const char* topic, const SensorData& d) {
  char payload[150];
  snprintf(payload, sizeof(payload),
    "{\"station\":\"Makumbura\",\"x_g\":%.4f,\"z_g\":%.4f,\"x_v\":%.4f,\"z_v\":%.4f}",
    d.x_g, d.z_g, d.x_voltage, d.z_voltage);
  mqttClient.publish(topic, payload);
}

void publishStatus(uint32_t idx) {
  char payload[200];
  snprintf(payload, sizeof(payload),
    "{\"station\":\"Makumbura\",\"sample\":%lu,\"sd\":%s,\"wifi\":%s,\"mqtt\":%s}",
    (unsigned long)idx,
    sdReady      ? "true" : "false",
    wifiConnected ? "true" : "false",
    mqttConnected ? "true" : "false");
  mqttClient.publish(TOPIC_STATUS, payload);
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE 0 TASK — WiFi + MQTT
// ═════════════════════════════════════════════════════════════════════════════
void mqttTask(void* pvParameters) {
  Serial.println("[Core 0] MAKUMBURA MQTT task started.");
  connectWiFi();
  connectMQTT();

  for (;;) {
    uint32_t now = millis();

    // ── WiFi watchdog ───────────────────────────────────────────────────────
    if (WiFi.status() != WL_CONNECTED) {
      wifiConnected = false;
      mqttConnected = false;
      if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
        lastWifiRetry = now;
        connectWiFi();
      }
    } else {
      wifiConnected = true;
    }

    // ── MQTT reconnect ──────────────────────────────────────────────────────
    if (wifiConnected && !mqttClient.connected()) {
      mqttConnected = false;
      if (now - lastMqttRetry >= MQTT_RETRY_INTERVAL) {
        lastMqttRetry = now;
        connectMQTT();
      }
    } else if (mqttClient.connected()) {
      mqttConnected = true;
      mqttClient.loop();
    }

    // ── Publish fresh sensor data ───────────────────────────────────────────
    if (mqttConnected && (now - lastPublish >= MQTT_PUBLISH_INTERVAL)) {
      lastPublish = now;

      // Safely copy shared data
      if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        SensorData  s1   = shared.s1;
        SensorData  s2   = shared.s2;
        uint32_t    idx  = shared.sampleIndex;
        shared.dataFresh = false;
        xSemaphoreGive(dataMutex);

        publishSensor(TOPIC_S1, s1);
        publishSensor(TOPIC_S2, s2);
        publishStatus(idx);
      }
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);  // yield to scheduler
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// SETUP
// ═════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(0)); // Initialize randomness for dynamic Client ID
  
  Serial.println("\n=== MAKUMBURA STATION | Dual ADXL335 | ADS1115 | SD + MQTT | ESP32 ===\n");
  Serial.print("Running on Core "); Serial.println(xPortGetCoreID());

  // ── Mutex for shared sensor data ───────────────────────────────────────────
  dataMutex = xSemaphoreCreateMutex();

  // ── ADS1115 (Core 1, I2C) ──────────────────────────────────────────────────
  Serial.println("[ ADS1115 Init ]");
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!ads.begin(ADS_ADDRESS)) {
    Serial.println("  FATAL: ADS1115 not found! Halting.");
    while (1);
  }
  ads.setGain(GAIN_ONE);
  Serial.println("  ADS1115 OK.\n");

  // ── SD Card ────────────────────────────────────────────────────────────────
  Serial.println("[ SD Card Init ]");
  sdReady = tryInitSD();
  Serial.println(sdReady ? "  SD OK.\n" : "  SD not ready — retrying in loop.\n");

  // ── Launch MQTT task on Core 0 ─────────────────────────────────────────────
  xTaskCreatePinnedToCore(
    mqttTask,       // function
    "MKB_MQTT",     // name (Makumbura MQTT)
    16384,          // stack size (for TLS handshakes)
    NULL,           // params
    1,              // priority
    NULL,           // handle
    0               // Core 0
  );

  lastSampleTime  = millis();
  lastFlushTime   = millis();
  lastSDRetryTime = millis();

  Serial.println("Starting MAKUMBURA measurements on Core 1...\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// LOOP — Core 1: Sensor read + SD log + share data
// ═════════════════════════════════════════════════════════════════════════════
void loop() {
  uint32_t now = millis();

  // ── 1. Read sensors at SAMPLE_INTERVAL_MS ─────────────────────────────────
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    SensorData s1 = readSensor(0, 1);
    SensorData s2 = readSensor(2, 3);

    printReadings(sampleIndex, s1, s2);

    // Share with Core 0 (MQTT task)
    if (xSemaphoreTake(dataMutex, pdMS_TO_TICKS(5)) == pdTRUE) {
      shared.s1          = s1;
      shared.s2          = s2;
      shared.sampleIndex = sampleIndex;
      shared.sdReady     = sdReady;
      shared.dataFresh   = true;
      xSemaphoreGive(dataMutex);
    }

    // SD buffer
    if (sdReady) {
      bufferRow(sampleIndex, s1, s2);
      if (bufferedRows >= BUFFER_ROWS) {
        flushBufferToSD();
        Serial.println("  SD: flushed (buffer full).");
      }
    }

    sampleIndex++;
  }

  // ── 2. Timed SD flush ─────────────────────────────────────────────────────
  if (sdReady && (now - lastFlushTime >= SD_FLUSH_INTERVAL_MS)) {
    lastFlushTime = now;
    if (bufferedRows > 0) {
      flushBufferToSD();
      Serial.println("  SD: flushed (timer).");
    }
  }

  // ── 3. Non-blocking SD retry ──────────────────────────────────────────────
  if (!sdReady && sdRetryCount < SD_MAX_RETRIES &&
      (now - lastSDRetryTime >= 2000)) {
    lastSDRetryTime = now;
    sdRetryCount++;
    Serial.print("  SD retry "); Serial.print(sdRetryCount);
    Serial.print("/"); Serial.print(SD_MAX_RETRIES); Serial.print(" ... ");
    sdReady = tryInitSD();
    Serial.println(sdReady ? "OK!" : "failed.");
  }
}
