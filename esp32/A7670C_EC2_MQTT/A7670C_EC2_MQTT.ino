// ============================================================
//  A7670C → EC2 Mosquitto MQTT  (plain TCP, port 1883)
//  Publishes fake sensor data at 5 Hz to trainflow/sensor/data
//
//  KEY:  AT+CMQTTACCQ server_type must be 0 (TCP), NOT 1 (SSL)
// ============================================================

#define RX_PIN 26   // ESP32 RX  ← A7670C TX
#define TX_PIN 27   // ESP32 TX  → A7670C RX

// ── EC2 Mosquitto broker (plain TCP, port 1883) ──────────────
const char* MQTT_HOST    = "13.239.236.121";
const char* MQTT_PORT    = "1883";
const char* MQTT_USER    = "trainflow";
const char* MQTT_PASS    = "Trainflow@2026!";
const char* MQTT_TOPIC   = "trainflow/sensor/data";
const char* MQTT_CLIENT  = "ESP32_TrainFlow_A7670C";

// ── Timing ───────────────────────────────────────────────────
const unsigned long PUBLISH_INTERVAL_MS   = 200;    // 5 Hz
const unsigned long RECONNECT_INTERVAL_MS = 10000;  // retry every 10 s

unsigned long lastPublishTime     = 0;
unsigned long lastReconnectAttempt = 0;
bool isConnected = false;

// ── Forward declarations ─────────────────────────────────────
String sendAT(const String& cmd, const String& expected, int timeoutMs);
bool   waitFor(const String& expected, int timeoutMs);
void   publishMQTT(const String& topic, const String& payload);
bool   connectMQTT();
void   resetMQTTStack();
bool   ensureNetwork();

// ════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN);
  delay(3000);

  Serial.println(F("======================================"));
  Serial.println(F("  A7670C → EC2 MQTT (TCP port 1883)   "));
  Serial.println(F("======================================"));

  if (!ensureNetwork()) {
    Serial.println(F("No 4G — will retry in loop."));
    return;
  }

  resetMQTTStack();
  isConnected = connectMQTT();
}

// ════════════════════════════════════════════════════════════
void loop() {
  if (!isConnected && millis() - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {
    lastReconnectAttempt = millis();
    if (ensureNetwork()) {
      resetMQTTStack();
      isConnected = connectMQTT();
    }
  }

  if (isConnected && millis() - lastPublishTime >= PUBLISH_INTERVAL_MS) {
    lastPublishTime = millis();
    float t = 20.0 + (random(0, 100) / 10.0);
    int   h = random(40, 60);
    String payload = "{\"t\":" + String(t, 1) + ",\"h\":" + String(h) + "}";
    publishMQTT(MQTT_TOPIC, payload);
  }

  if (Serial.available())  Serial2.print(Serial.readString());
  if (Serial2.available()) Serial.print(Serial2.readString());
}

// ════════════════════════════════════════════════════════════
bool ensureNetwork() {
  Serial.println(F("\n--- Waiting for 4G ---"));
  for (int i = 0; i < 20; i++) {
    String r = sendAT("AT+CEREG?", "OK", 1500);
    if (r.indexOf("+CEREG: 0,1") != -1 || r.indexOf("+CEREG: 0,5") != -1) {
      Serial.println(F("4G connected."));
      delay(1500);
      return true;
    }
    Serial.println(F("Searching..."));
    delay(1000);
  }
  return false;
}

// ════════════════════════════════════════════════════════════
void resetMQTTStack() {
  Serial.println(F("\n--- Resetting MQTT stack ---"));
  sendAT("AT+CMQTTDISC=0,60", "OK", 2000);
  sendAT("AT+CMQTTREL=0",     "OK", 2000);
  sendAT("AT+CMQTTSTOP",      "OK", 3000);
  delay(500);
  sendAT("AT+CMQTTSTART",     "OK", 4000);
  delay(300);

  // server_type = 0 → plain TCP (NOT 1 which is SSL!)
  String accqCmd = String("AT+CMQTTACCQ=0,\"") + MQTT_CLIENT + "\",0";
  sendAT(accqCmd, "OK", 4000);
  delay(300);
}

// ════════════════════════════════════════════════════════════
bool connectMQTT() {
  Serial.print(F("\n--- Connecting to "));
  Serial.print(MQTT_HOST);
  Serial.print(F(":"));
  Serial.println(MQTT_PORT);

  String cmd = String("AT+CMQTTCONNECT=0,\"tcp://")
             + MQTT_HOST + ":" + MQTT_PORT
             + "\",60,1,\""
             + MQTT_USER + "\",\""
             + MQTT_PASS + "\"";

  String resp = sendAT(cmd, "OK", 15000);

  if (resp.indexOf("+CMQTTCONNECT: 0,0") != -1) {
    Serial.println(F("Connected to EC2 MQTT broker!"));
    return true;
  }

  int errIdx = resp.indexOf("+CMQTTCONNECT: 0,");
  if (errIdx != -1) {
    Serial.print(F("Connect error code: "));
    Serial.println(resp.substring(errIdx + 17, errIdx + 19));
    Serial.println(F("  0=OK  1=protocol  2=id  3=server  4=credentials  5=not-auth"));
  }

  sendAT("AT+CMQTTDISC=0,60", "OK", 2000);
  return false;
}

// ════════════════════════════════════════════════════════════
void publishMQTT(const String& topic, const String& payload) {
  unsigned long t0 = millis();

  Serial2.print("AT+CMQTTTOPIC=0,");
  Serial2.println(topic.length());
  if (!waitFor(">", 500)) { Serial.println(F("Topic prompt timeout")); isConnected = false; return; }
  Serial2.print(topic);
  waitFor("OK", 500);

  Serial2.print("AT+CMQTTPAYLOAD=0,");
  Serial2.println(payload.length());
  if (!waitFor(">", 500)) { Serial.println(F("Payload prompt timeout")); isConnected = false; return; }
  Serial2.print(payload);
  waitFor("OK", 500);

  Serial2.println("AT+CMQTTPUB=0,0,60");
  if (waitFor("+CMQTTPUB: 0,0", 2000)) {
    Serial.print(F("Sent: ")); Serial.print(payload);
    Serial.print(F("  (")); Serial.print(millis() - t0); Serial.println(F("ms)"));
  } else {
    Serial.println(F("Publish timeout — reconnecting"));
    isConnected = false;
  }
}

// ════════════════════════════════════════════════════════════
String sendAT(const String& cmd, const String& expected, int timeoutMs) {
  String response;
  Serial2.println(cmd);
  unsigned long start = millis();
  while (millis() - start < (unsigned long)timeoutMs) {
    while (Serial2.available()) response += (char)Serial2.read();
    if (response.indexOf(expected) != -1) break;
  }
  Serial.print(F(">> ")); Serial.println(cmd);
  Serial.print(F("<< ")); Serial.println(response);
  Serial.println(F("---"));
  return response;
}

bool waitFor(const String& expected, int timeoutMs) {
  String response;
  unsigned long start = millis();
  while (millis() - start < (unsigned long)timeoutMs) {
    while (Serial2.available()) response += (char)Serial2.read();
    if (response.indexOf(expected) != -1) return true;
  }
  return false;
}
