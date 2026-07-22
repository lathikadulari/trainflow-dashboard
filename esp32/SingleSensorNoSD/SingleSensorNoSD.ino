/*
  ============================================================
  Single ADXL335 (X/Y/Z) -> ESP32 -> HiveMQ Cloud MQTT (TLS)
  NO SD CARD SETUP
  ============================================================

  WIRING (ADXL335 -> ADS1115 -> ESP32):
    ADXL335 XOUT -> ADS1115 A0
    ADXL335 YOUT -> ADS1115 A1
    ADXL335 ZOUT -> ADS1115 A2
    ADXL335 VCC  -> 3.3V
    ADXL335 GND  -> GND

  I2C (ESP32 -> ADS1115):
    GPIO21 (SDA) -> ADS1115 SDA
    GPIO22 (SCL) -> ADS1115 SCL
    ADS1115 ADDR -> GND (0x48)

  MQTT TOPICS (new sensors page setup):
    sensorlab/sensor1 -> {x,y,z,magnitude,voltage:{x,y,z},x_g,y_g,z_g,x_v,y_v,z_v,timestamp}
    sensorlab/status  -> {status,sample,wifi,mqtt,ip}

  Required libraries:
    - Adafruit ADS1X15 (Adafruit)
    - PubSubClient (Nick O'Leary)
    - ArduinoJson (Benoit Blanchon)
*/

#include <Wire.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_ADS1X15.h>

// WiFi
const char* WIFI_SSID = "test";
const char* WIFI_PASSWORD = "12345678";

// HiveMQ Cloud MQTT
const char* MQTT_SERVER    = "13.235.248.117";
const int   MQTT_PORT      = 1883;
const char* MQTT_USER      = "trainflow";
const char* MQTT_PASS      = "Trainflow@2026!";
const char* MQTT_CLIENT_ID = "ESP32_SENSORLAB_SINGLE_01";

// Topics for the new /sensors page setup
const char* TOPIC_SENSOR = "sensorlab/sensor1";
const char* TOPIC_STATUS = "sensorlab/status";

// ADS1115 / I2C
const uint8_t I2C_SDA_PIN = 21;
const uint8_t I2C_SCL_PIN = 22;
const uint8_t ADS_ADDRESS = 0x48;
const uint8_t ADS_CH_X = 0; // A0
const uint8_t ADS_CH_Y = 1; // A1
const uint8_t ADS_CH_Z = 2; // A2

// ADXL335 calibration
const float SUPPLY_VOLTAGE = 3.3f;
const float ZERO_G_VOLTAGE = SUPPLY_VOLTAGE / 2.0f;
const float SENSITIVITY_V_PER_G = 0.300f;

// Timing
const uint32_t SENSOR_INTERVAL_MS = 100;  // 10 Hz
const uint32_t STATUS_INTERVAL_MS = 1000; // 1 Hz
const uint32_t WIFI_RETRY_MS = 5000;
const uint32_t MQTT_RETRY_MS = 3000;

WiFiClient netClient;
PubSubClient mqttClient(netClient);
Adafruit_ADS1115 ads;

bool wifiConnected = false;
bool mqttConnected = false;
uint32_t sampleIndex = 0;
uint32_t lastSensorMs = 0;
uint32_t lastStatusMs = 0;
uint32_t lastWifiRetryMs = 0;
uint32_t lastMqttRetryMs = 0;

float adsRawToVoltage(int16_t raw) {
  // GAIN_ONE on ADS1115 is +/-4.096V, LSB = 125uV.
  return raw * 0.000125f;
}

float voltageToG(float voltage) {
  return (voltage - ZERO_G_VOLTAGE) / SENSITIVITY_V_PER_G;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    return;
  }

  Serial.print("WiFi connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 10000) {
    delay(200);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("WiFi connection failed.");
  }
}

void connectMQTT() {
  if (!wifiConnected) return;

  
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setKeepAlive(60);

  String clientId = String(MQTT_CLIENT_ID) + "_" + String(random(0xffff), HEX);

  Serial.print("MQTT connecting...");
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, TOPIC_STATUS, 0, true, "{\"status\":\"offline\"}")) {
    mqttConnected = true;
    Serial.println(" connected.");
    publishStatus("online");
  } else {
    mqttConnected = false;
    Serial.print(" failed, rc=");
    Serial.println(mqttClient.state());
  }
}

void publishStatus(const char* statusText) {
  if (!mqttConnected) return;

  StaticJsonDocument<192> doc;
  doc["status"] = statusText;
  doc["sample"] = sampleIndex;
  doc["wifi"] = wifiConnected;
  doc["mqtt"] = mqttConnected;
  doc["ip"] = WiFi.localIP().toString();

  char payload[192];
  serializeJson(doc, payload, sizeof(payload));
  mqttClient.publish(TOPIC_STATUS, payload, true);
}

void publishSensorSample() {
  if (!mqttConnected) return;

  int16_t rawX = ads.readADC_SingleEnded(ADS_CH_X);
  int16_t rawY = ads.readADC_SingleEnded(ADS_CH_Y);
  int16_t rawZ = ads.readADC_SingleEnded(ADS_CH_Z);

  float xV = adsRawToVoltage(rawX);
  float yV = adsRawToVoltage(rawY);
  float zV = adsRawToVoltage(rawZ);

  float xG = voltageToG(xV);
  float yG = voltageToG(yV);
  float zG = voltageToG(zV);

  float xMilliG = xG * 1000.0f;
  float yMilliG = yG * 1000.0f;
  float zMilliG = zG * 1000.0f;
  float magnitude = sqrtf((xMilliG * xMilliG) + (yMilliG * yMilliG) + (zMilliG * zMilliG));

  StaticJsonDocument<384> doc;
  doc["timestamp"] = millis();
  doc["x"] = xMilliG;
  doc["y"] = yMilliG;
  doc["z"] = zMilliG;
  doc["magnitude"] = magnitude;
  doc["x_g"] = xG;
  doc["y_g"] = yG;
  doc["z_g"] = zG;
  doc["x_v"] = xV;
  doc["y_v"] = yV;
  doc["z_v"] = zV;

  JsonObject voltage = doc.createNestedObject("voltage");
  voltage["x"] = xV;
  voltage["y"] = yV;
  voltage["z"] = zV;

  char payload[384];
  serializeJson(doc, payload, sizeof(payload));
  mqttClient.publish(TOPIC_SENSOR, payload);

  Serial.print("#");
  Serial.print(sampleIndex);
  Serial.print(" X=");
  Serial.print(xMilliG, 2);
  Serial.print("mg Y=");
  Serial.print(yMilliG, 2);
  Serial.print("mg Z=");
  Serial.print(zMilliG, 2);
  Serial.println("mg");

  sampleIndex++;
}

void setup() {
  Serial.begin(115200);
  randomSeed((uint32_t)micros());

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  if (!ads.begin(ADS_ADDRESS)) {
    Serial.println("ADS1115 not detected at 0x48. Check wiring.");
    while (true) {
      delay(500);
    }
  }
  ads.setGain(GAIN_ONE);

  Serial.println("=== SensorLab Single Sensor (No SD) ===");
  Serial.println("ADS1115 ready on channels A0/A1/A2 (X/Y/Z)");
  connectWiFi();
  connectMQTT();
}

void loop() {
  uint32_t now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    mqttConnected = false;
    if (now - lastWifiRetryMs >= WIFI_RETRY_MS) {
      lastWifiRetryMs = now;
      connectWiFi();
    }
  } else {
    wifiConnected = true;
  }

  if (wifiConnected && !mqttClient.connected()) {
    mqttConnected = false;
    if (now - lastMqttRetryMs >= MQTT_RETRY_MS) {
      lastMqttRetryMs = now;
      connectMQTT();
      if (mqttConnected) publishStatus("online");
    }
  }

  if (mqttClient.connected()) {
    mqttConnected = true;
    mqttClient.loop();
  }

  if (mqttConnected && (now - lastSensorMs >= SENSOR_INTERVAL_MS)) {
    lastSensorMs = now;
    publishSensorSample();
  }

  if (mqttConnected && (now - lastStatusMs >= STATUS_INTERVAL_MS)) {
    lastStatusMs = now;
    publishStatus("online");
  }

  delay(5);
}
