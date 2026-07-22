/*
  ============================================================
  MAKUMBURA STATION — Dual ADXL335 + ADS1115 + SD Card
  SIM7670C 4G → EC2 Mosquitto MQTT (AT Commands)
  Station ID: MKB01
  ============================================================

  WIRING:
    SIM7670C:  GPIO26 (ESP32 RX ← Module TX)
               GPIO27 (ESP32 TX → Module RX)
    ADS1115:   GPIO21 SDA, GPIO22 SCL, ADDR→GND (0x48)
    SD Card:   GPIO18 CS, GPIO23 SCK, GPIO5 MOSI, GPIO19 MISO

    ADXL335 → ADS1115:
      A0 → Right Sensor Y    A1 → Right Sensor Z   (Sensor1 = Right)
      A2 → Left Sensor Y     A3 → Left Sensor Z    (Sensor2 = Left)

  MQTT TOPICS:
    makumbura/sensor1  → Right sensor: {"station":"Makumbura","y_g":...,"z_g":...,"y_v":...,"z_v":...}
    makumbura/sensor2  → Left sensor:  {"station":"Makumbura","y_g":...,"z_g":...,"y_v":...,"z_v":...}
    makumbura/status   → {"station":"Makumbura","sample":...,"sd":...,"mqtt":...}
  ============================================================
*/

#include <Wire.h>
#include <SPI.h>
#include <SD.h>
#include <Adafruit_ADS1X15.h>

// ── SIM7670C UART ────────────────────────────────────────────
#define RX_PIN 26  // ESP32 RX pin (module TX)
#define TX_PIN 27  // ESP32 TX pin (module RX)

// ── EC2 MQTT broker credentials ─────────────────────────────
String mqtt_server = "13.235.248.117";
String mqtt_port   = "1883";
String mqtt_user   = "trainflow";
String mqtt_pass   = "Trainflow@2026!";

const char* mqttHosts[]    = {
  "13.235.248.117"
};
const int mqttHostsCount   = 1;
const char* mqttPorts[]    = {"1883"};
const int mqttPortsCount   = 1;

// ── MQTT Topics (Makumbura) ─────────────────────────────────
String topic_sensor1 = "makumbura/sensor1";
String topic_sensor2 = "makumbura/sensor2";
String topic_status  = "makumbura/status";

// ── I2C / ADS1115 ───────────────────────────────────────────
#define SDA_PIN      21
#define SCL_PIN      22
#define ADS_ADDRESS  0x48

Adafruit_ADS1115 ads;

// ── ADXL335 Calibration ─────────────────────────────────────
const float SUPPLY_VOLTAGE = 3.3f;
const float ZERO_G_VOLTAGE = SUPPLY_VOLTAGE / 2.0f;
const float SENSITIVITY_V  = 0.300f;

// ── SPI / SD Card ───────────────────────────────────────────
#define SD_CS    18
#define SD_SCK   23
#define SD_MOSI   5
#define SD_MISO  19

const char* LOG_FILE = "/makumbura_data.csv";
bool     sdReady      = false;
uint8_t  sdRetryCount = 0;
const uint8_t SD_MAX_RETRIES = 5;

String   csvBuffer    = "";
uint8_t  bufferedRows = 0;
#define  BUFFER_ROWS  10

// ── Timing ──────────────────────────────────────────────────────
unsigned long lastPublishTime     = 0;
const long    publishInterval     = 50;           // 20 Hz MQTT publish
unsigned long lastStatusTime      = 0;
const long    statusInterval      = 2000;         // status every 2 s
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectIntervalMs = 10000;
unsigned long lastSampleTime      = 0;
const uint32_t SAMPLE_INTERVAL_MS = 20;           // 50 Hz sensor read
unsigned long lastFlushTime       = 0;
const uint32_t SD_FLUSH_INTERVAL  = 1000;
unsigned long lastSDRetryTime     = 0;

bool     isConnected = false;
uint32_t sampleIndex = 0;

// ── Sensor data struct ──────────────────────────────────────────
struct SensorData {
  float y_g, z_g;
  float y_v, z_v;
  unsigned long t_us;   // microsecond timestamp of this reading
};

SensorData sensor1, sensor2;

// ── Forward declarations ────────────────────────────────────
String sendATCommand(String command, String expected_response, int timeout);
bool   waitFor(String expected, int timeout);
void   publishMQTT(String topic, String payload);
bool   connectMQTTWithFallback();
bool   ensureNetworkRegistration();
void   resetMQTTStack();
bool   waitForModuleReady();

// ═════════════════════════════════════════════════════════════
// SIM7670C MODULE BOOT WAIT
// ═════════════════════════════════════════════════════════════
bool waitForModuleReady() {
  Serial.println("\n--- [MAKUMBURA] Waiting for SIM7670C to boot ---");

  // Step 1: Wait up to 20 seconds for any boot-complete signal
  //   SIM7670C outputs: SMS DONE, +CGEV: EPS PDN ACT, etc.
  //   A7670C outputs:   *ATREADY, PB DONE
  unsigned long start = millis();
  bool gotReady = false;

  while (millis() - start < 20000) {
    String chunk = "";
    while (Serial2.available()) {
      char c = Serial2.read();
      chunk += c;
    }
    if (chunk.length() > 0) {
      Serial.print(chunk);  // echo boot messages

      if (chunk.indexOf("SMS DONE") != -1 ||
          chunk.indexOf("*ATREADY") != -1 ||
          chunk.indexOf("PB DONE") != -1 ||
          chunk.indexOf("+CGEV: EPS PDN ACT") != -1) {
        gotReady = true;
        Serial.println("\n  >> Boot signal detected!");
        break;
      }
    }
    delay(100);
  }

  if (!gotReady) {
    Serial.println("\n  Boot signal timeout (20s) — proceeding anyway...");
  }

  // Step 2: Wait for +CGEV URC storm to settle (these keep coming)
  Serial.println("  Waiting for URC storm to settle...");
  delay(3000);

  // Step 3: Aggressive flush — drain everything in the buffer
  Serial.println("  Flushing serial buffer...");
  unsigned long flushStart = millis();
  while (millis() - flushStart < 2000) {
    while (Serial2.available()) {
      Serial2.read();  // discard
    }
    delay(50);
  }

  // Step 4: Test AT command — flush between each retry
  Serial.println("  Testing AT command...");
  for (int i = 0; i < 10; i++) {
    // Flush any URCs that arrived since last attempt
    while (Serial2.available()) Serial2.read();
    delay(100);

    // Send AT and look for OK
    Serial2.println("AT");
    delay(500);

    String resp = "";
    unsigned long t = millis();
    while (millis() - t < 2000) {
      while (Serial2.available()) {
        resp += (char)Serial2.read();
      }
      if (resp.indexOf("OK") != -1) break;
      delay(10);
    }

    Serial.print("  AT attempt "); Serial.print(i + 1);
    Serial.print("/10: ["); Serial.print(resp); Serial.println("]");

    if (resp.indexOf("OK") != -1) {
      Serial.println("  SIM7670C is ready!");
      // Disable echo to keep responses clean
      while (Serial2.available()) Serial2.read();
      Serial2.println("ATE0");
      delay(500);
      while (Serial2.available()) Serial2.read();
      return true;
    }

    delay(1000);  // wait before next retry
  }

  Serial.println("  WARNING: No AT OK response after 10 attempts.");
  Serial.println("  Check TX/RX wiring and module power.");
  return false;
}

// ═════════════════════════════════════════════════════════════
// SENSOR HELPERS
// ═════════════════════════════════════════════════════════════
float rawToVoltage(int16_t raw) { return raw * 0.000125f; }
float voltageToG(float v)       { return (v - ZERO_G_VOLTAGE) / SENSITIVITY_V; }

SensorData readSensor(uint8_t ch_y, uint8_t ch_z) {
  SensorData d;
  d.t_us = micros();   // timestamp BEFORE reading starts
  d.y_v = rawToVoltage(ads.readADC_SingleEnded(ch_y));
  d.z_v = rawToVoltage(ads.readADC_SingleEnded(ch_z));
  d.y_g = voltageToG(d.y_v);
  d.z_g = voltageToG(d.z_v);
  return d;
}

// ═════════════════════════════════════════════════════════════
// SD CARD HELPERS
// ═════════════════════════════════════════════════════════════
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
    f.println("sample_index,s1_t_us,s1_y_g,s1_z_g,s1_y_v,s1_z_v,s2_t_us,s2_y_g,s2_z_g,s2_y_v,s2_z_v");
    Serial.println("  SD: header written.");
  } else {
    Serial.print("  SD: appending (");
    Serial.print((uint32_t)f.size()); Serial.println(" bytes).");
  }
  f.close();
}

bool tryInitSD() {
  pinMode(SD_CS, OUTPUT);
  digitalWrite(SD_CS, HIGH);
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (SD.begin(SD_CS, SPI, 4000000)) {
    printSDInfo();
    writeCSVHeader();
    return true;
  }
  SD.end();
  delay(20);
  SPI.begin(SD_SCK, SD_MISO, SD_MOSI, SD_CS);
  if (SD.begin(SD_CS, SPI, 1000000)) {
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
  csvBuffer += idx;                      csvBuffer += ',';
  csvBuffer += String(s1.t_us);         csvBuffer += ',';
  csvBuffer += String(s1.y_g, 4);       csvBuffer += ',';
  csvBuffer += String(s1.z_g, 4);       csvBuffer += ',';
  csvBuffer += String(s1.y_v, 4);       csvBuffer += ',';
  csvBuffer += String(s1.z_v, 4);       csvBuffer += ',';
  csvBuffer += String(s2.t_us);         csvBuffer += ',';
  csvBuffer += String(s2.y_g, 4);       csvBuffer += ',';
  csvBuffer += String(s2.z_g, 4);       csvBuffer += ',';
  csvBuffer += String(s2.y_v, 4);       csvBuffer += ',';
  csvBuffer += String(s2.z_v, 4);       csvBuffer += '\n';
  bufferedRows++;
}

// ═════════════════════════════════════════════════════════════
// SERIAL PRINT
// ═════════════════════════════════════════════════════════════
void printReadings(uint32_t idx, const SensorData& s1, const SensorData& s2) {
  Serial.println("--------------------------------------------------");
  Serial.print("[MAKUMBURA #"); Serial.print(idx); Serial.print("]");
  Serial.print("  MQTT:"); Serial.println(isConnected ? "OK" : "--");

  Serial.print("S1 @"); Serial.print(s1.t_us);
  Serial.print("us | Y:"); Serial.print(s1.y_g, 3);
  Serial.print("g (");     Serial.print(s1.y_v, 4);
  Serial.print("V) Z:");   Serial.print(s1.z_g, 3);
  Serial.print("g (");     Serial.print(s1.z_v, 4);
  Serial.println("V)");

  Serial.print("S2 @"); Serial.print(s2.t_us);
  Serial.print("us | Y:"); Serial.print(s2.y_g, 3);
  Serial.print("g (");     Serial.print(s2.y_v, 4);
  Serial.print("V) Z:");   Serial.print(s2.z_g, 3);
  Serial.print("g (");     Serial.print(s2.z_v, 4);
  Serial.print("V)  dt="); Serial.print(s2.t_us - s1.t_us);
  Serial.println("us");

  if (sdReady) {
    Serial.print("SD: buf "); Serial.print(bufferedRows);
    Serial.print("/"); Serial.println(BUFFER_ROWS);
  } else {
    Serial.println("SD: not ready");
  }
}

// ═════════════════════════════════════════════════════════════
// SETUP
// ═════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN);
  delay(1000);  // brief initial delay

  Serial.println("============================================================");
  Serial.println("  MAKUMBURA STATION | Dual ADXL335 | ADS1115 | SD + 4G MQTT");
  Serial.println("  SIM7670C → EC2 Mosquitto (AT Commands)");
  Serial.println("============================================================");

  // ── ADS1115 Init ──────────────────────────────────────────
  Serial.println("\n[ ADS1115 Init ]");
  Wire.begin(SDA_PIN, SCL_PIN);
  if (!ads.begin(ADS_ADDRESS)) {
    Serial.println("  FATAL: ADS1115 not found! Halting.");
    while (1);
  }
  ads.setGain(GAIN_ONE);
  ads.setDataRate(RATE_ADS1115_860SPS);  // 860 SPS = ~1.2ms per read (was default 128 SPS = ~7.8ms)
  Serial.println("  ADS1115 OK — 860 SPS mode.");

  // ── SD Card Init ──────────────────────────────────────────
  Serial.println("\n[ SD Card Init ]");
  sdReady = tryInitSD();
  Serial.println(sdReady ? "  SD OK." : "  SD not ready — retrying in loop.");

  // ── Wait for SIM7670C module to fully boot ────────────────
  waitForModuleReady();

  // ── 4G Network + MQTT ─────────────────────────────────────
  if (!ensureNetworkRegistration()) {
    Serial.println("Could not register on network now. Will retry in loop.");
    return;
  }

  Serial.println("\n--- Cleaning old MQTT sessions ---");
  resetMQTTStack();

  isConnected = connectMQTTWithFallback();

  // Publish online status
  if (isConnected) {
    String onlineMsg = "{\"station\":\"Makumbura\",\"status\":\"online\",\"device\":\"MKB01\",\"connection\":\"4G_SIM7670C\"}";
    publishMQTT(topic_status, onlineMsg);
  }

  lastSampleTime  = millis();
  lastFlushTime   = millis();
  lastSDRetryTime = millis();
}

// ═════════════════════════════════════════════════════════════
// LOOP
// ═════════════════════════════════════════════════════════════
void loop() {
  unsigned long now = millis();

  // ── MQTT Reconnect ────────────────────────────────────────
  if (!isConnected && now - lastReconnectAttempt >= reconnectIntervalMs) {
    lastReconnectAttempt = now;
    if (ensureNetworkRegistration()) {
      resetMQTTStack();
      isConnected = connectMQTTWithFallback();
    }
  }

  // ── Read Sensors at 10 Hz ─────────────────────────────────
  if (now - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = now;

    sensor1 = readSensor(0, 1);   // ADS ch0=Y, ch1=Z
    sensor2 = readSensor(2, 3);   // ADS ch2=Y, ch3=Z

    printReadings(sampleIndex, sensor1, sensor2);

    // SD buffer
    if (sdReady) {
      bufferRow(sampleIndex, sensor1, sensor2);
      if (bufferedRows >= BUFFER_ROWS) {
        flushBufferToSD();
        Serial.println("  SD: flushed (buffer full).");
      }
    }

    sampleIndex++;
  }

  // ── Publish sensor data via MQTT at 20 Hz ─────────────────
  if (isConnected && (now - lastPublishTime >= publishInterval)) {
    lastPublishTime = now;

    // Sensor 1
    String p1 = "{\"station\":\"Makumbura\",\"sensor\":1,\"t_us\":"
              + String(sensor1.t_us) + ",\"y_g\":"
              + String(sensor1.y_g, 4) + ",\"z_g\":" + String(sensor1.z_g, 4)
              + ",\"y_v\":" + String(sensor1.y_v, 4) + ",\"z_v\":" + String(sensor1.z_v, 4) + "}";
    publishMQTT(topic_sensor1, p1);

    // Sensor 2
    String p2 = "{\"station\":\"Makumbura\",\"sensor\":2,\"t_us\":"
              + String(sensor2.t_us) + ",\"y_g\":"
              + String(sensor2.y_g, 4) + ",\"z_g\":" + String(sensor2.z_g, 4)
              + ",\"y_v\":" + String(sensor2.y_v, 4) + ",\"z_v\":" + String(sensor2.z_v, 4) + "}";
    publishMQTT(topic_sensor2, p2);
  }

  // ── Publish status at lower rate ──────────────────────────
  if (isConnected && (now - lastStatusTime >= statusInterval)) {
    lastStatusTime = now;

    String ps = "{\"station\":\"Makumbura\",\"sample\":" + String(sampleIndex)
              + ",\"sd\":" + String(sdReady ? "true" : "false")
              + ",\"mqtt\":" + String(isConnected ? "true" : "false") + "}";
    publishMQTT(topic_status, ps);
  }

  // ── Timed SD flush ────────────────────────────────────────
  if (sdReady && (now - lastFlushTime >= SD_FLUSH_INTERVAL)) {
    lastFlushTime = now;
    if (bufferedRows > 0) {
      flushBufferToSD();
      Serial.println("  SD: flushed (timer).");
    }
  }

  // ── SD retry ──────────────────────────────────────────────
  if (!sdReady && sdRetryCount < SD_MAX_RETRIES && (now - lastSDRetryTime >= 2000)) {
    lastSDRetryTime = now;
    sdRetryCount++;
    Serial.print("  SD retry "); Serial.print(sdRetryCount);
    Serial.print("/"); Serial.print(SD_MAX_RETRIES); Serial.print(" ... ");
    sdReady = tryInitSD();
    Serial.println(sdReady ? "OK!" : "failed.");
  }

  // ── Serial passthrough for debugging AT commands ──────────
  if (Serial.available()) {
    Serial2.print(Serial.readString());
  }
  if (Serial2.available()) {
    Serial.print(Serial2.readString());
  }
}

// ═════════════════════════════════════════════════════════════
// MQTT STACK RESET (AT Commands)
// ═════════════════════════════════════════════════════════════
void resetMQTTStack() {
  sendATCommand("AT+CMQTTDISC=0,60", "OK", 2000);
  sendATCommand("AT+CMQTTREL=0", "OK", 2000);
  sendATCommand("AT+CMQTTSTOP", "OK", 3000);
  delay(400);

  sendATCommand("AT+CMQTTSTART", "OK", 4000);
  delay(300);
  // server_type = 0 (plain TCP). 1 = SSL and would cause CMQTTCONNECT error 3 / 32
  sendATCommand("AT+CMQTTACCQ=0,\"ESP32_Makumbura_MKB01\",0", "OK", 4000);
  delay(300);
}

// ═════════════════════════════════════════════════════════════
// 4G NETWORK REGISTRATION
// ═════════════════════════════════════════════════════════════
bool ensureNetworkRegistration() {
  Serial.println("\n--- [MAKUMBURA] Waiting for 4G Network ---");
  for (int i = 0; i < 20; i++) {
    String status = sendATCommand("AT+CEREG?", "OK", 1500);
    if (status.indexOf("+CEREG: 0,1") != -1 || status.indexOf("+CEREG: 0,5") != -1) {
      Serial.println("[MAKUMBURA] 4G Network Connected");
      delay(1500);
      return true;
    }
    Serial.println("  Still searching for network...");
    delay(1000);
  }
  return false;
}

// ═════════════════════════════════════════════════════════════
// MQTT CONNECT WITH HOST/PORT FALLBACK
// ═════════════════════════════════════════════════════════════
bool connectMQTTWithFallback() {
  Serial.println("\n--- [MAKUMBURA] Connecting to EC2 broker ---");
  for (int h = 0; h < mqttHostsCount; h++) {
    mqtt_server = mqttHosts[h];
    for (int i = 0; i < mqttPortsCount; i++) {
      mqtt_port = mqttPorts[i];
      Serial.println("  Trying " + mqtt_server + ":" + mqtt_port + "...");

      String connectCmd = "AT+CMQTTCONNECT=0,\"tcp://"
                        + mqtt_server + ":" + mqtt_port
                        + "\",60,1,\"" + mqtt_user + "\",\"" + mqtt_pass + "\"";
      String response = sendATCommand(connectCmd, "OK", 15000);

      if (response.indexOf("+CMQTTCONNECT: 0,0") != -1) {
        Serial.println("[MAKUMBURA] Connected to EC2 MQTT at " + mqtt_server + ":" + mqtt_port);
        return true;
      }

      Serial.println("  Connect failed at " + mqtt_server + ":" + mqtt_port);
      sendATCommand("AT+CMQTTDISC=0,60", "OK", 2000);
      delay(800);
    }
  }

  Serial.println("[MAKUMBURA] Failed to connect on all host/port combos.");
  return false;
}

// ═════════════════════════════════════════════════════════════
// MQTT PUBLISH (AT Commands)
// ═════════════════════════════════════════════════════════════
void publishMQTT(String topic, String payload) {
  unsigned long totalStart = millis();

  Serial2.print("AT+CMQTTTOPIC=0,");
  Serial2.println(topic.length());
  if (waitFor(">", 500)) {
    Serial2.print(topic);
    waitFor("OK", 500);
  } else {
    Serial.println("[MAKUMBURA] Topic setup failed (module busy)");
    isConnected = false;
    return;
  }

  Serial2.print("AT+CMQTTPAYLOAD=0,");
  Serial2.println(payload.length());
  if (waitFor(">", 500)) {
    Serial2.print(payload);
    waitFor("OK", 500);
  } else {
    Serial.println("[MAKUMBURA] Payload setup failed (module busy)");
    isConnected = false;
    return;
  }

  Serial2.println("AT+CMQTTPUB=0,0,60");
  if (waitFor("+CMQTTPUB: 0,0", 2000)) {
    unsigned long totalTime = millis() - totalStart;
    Serial.println("[MKB] Sent: " + payload + " | " + String(totalTime) + "ms");
  } else {
    Serial.println("[MAKUMBURA] Publish timeout — will reconnect");
    isConnected = false;
  }
}

// ═════════════════════════════════════════════════════════════
// AT COMMAND SEND + WAIT HELPERS
// ═════════════════════════════════════════════════════════════
String sendATCommand(String command, String expected_response, int timeout) {
  String response = "";
  Serial2.println(command);
  long int time = millis();

  while ((time + timeout) > millis()) {
    while (Serial2.available()) {
      char c = Serial2.read();
      response += c;
    }
    if (response.indexOf(expected_response) != -1) {
      break;
    }
  }

  if (!isConnected) {
    Serial.print(">> ");
    Serial.println(command);
    Serial.print("<< ");
    Serial.println(response);
    Serial.println("------------------------");
  }

  return response;
}

bool waitFor(String expected, int timeout) {
  String response = "";
  long int time = millis();

  while ((time + timeout) > millis()) {
    while (Serial2.available()) {
      response += char(Serial2.read());
    }
    if (response.indexOf(expected) != -1) {
      return true;
    }
  }

  return false;
}
