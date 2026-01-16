/*
 * TrainFlow ESP32 Simulated Sensor Publisher
 * 
 * Publishes simulated ADXL335 accelerometer data to HiveMQ Cloud
 * Use this when you don't have a physical sensor connected
 * 
 * Hardware: ESP32 (any variant)
 * Connection: USB to COM4
 * 
 * Required Libraries (install via Arduino Library Manager):
 * - PubSubClient by Nick O'Leary
 * - WiFiClientSecure (built-in with ESP32)
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============= WIFI CONFIGURATION =============
const char* ssid = "SLT-4G_1EE41C";
const char* password = "OnTheWay123";

// ============= HIVEMQ CLOUD CONFIGURATION =============
const char* mqtt_server = "8102284b29c24b4eb40e06ac182d1130.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_username = "lathika";
const char* mqtt_password = "Lathika2002";

// MQTT Topics
const char* topic_sensorA = "trainflow/sensor/A";
const char* topic_sensorB = "trainflow/sensor/B";
const char* topic_status = "trainflow/status";

// HiveMQ Cloud Root CA Certificate
const char* root_ca = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

// ============= SIMULATION CONFIGURATION =============
const float SAMPLE_RATE = 50.0;  // 50 Hz sampling rate
const float BASELINE_NOISE = 500.0;
const float MAX_AMPLITUDE = 60000.0;

// ADXL335 Specifications
const float ZERO_G_VOLTAGE = 1.65;
const float SENSITIVITY = 0.33;  // 330mV/g

// Train simulation state
bool trainActive = false;
String trainDirection = "";
float trainSpeed = 0;
String trainPhase = "idle";
unsigned long trainStartTime = 0;
unsigned long lastPublishTime = 0;

// WiFi and MQTT clients
WiFiClientSecure espClient;
PubSubClient client(espClient);

// ============= HELPER FUNCTIONS =============

float gaussianRandom(float mean, float stdev) {
  float u1 = random(1, 10000) / 10000.0;
  float u2 = random(1, 10000) / 10000.0;
  float z0 = sqrt(-2.0 * log(u1)) * cos(2.0 * PI * u2);
  return z0 * stdev + mean;
}

float rawToVoltage(float rawValue) {
  float gForce = rawValue / (MAX_AMPLITUDE / 3.0);
  float voltage = ZERO_G_VOLTAGE + (gForce * SENSITIVITY);
  return constrain(voltage, 0.0, 3.3);
}

void generateBaseline(float* x, float* y, float* z) {
  *x = gaussianRandom(0, BASELINE_NOISE * 0.3);
  *y = gaussianRandom(0, BASELINE_NOISE * 0.3);
  *z = gaussianRandom(0, BASELINE_NOISE * 0.2);
}

void generateTrainSignal(float* x, float* y, float* z, float intensity) {
  float t = millis() / 1000.0;
  float amp = MAX_AMPLITUDE * intensity;
  
  // Multiple frequency components (60-150 Hz)
  float f1 = 60 + random(0, 20);
  float f2 = 120 + random(0, 30);
  float f3 = 40 + random(0, 10);
  
  // Burst modulation
  float burstFreq = 8 + random(0, 4);
  float burstEnvelope = 0.5 + 0.5 * sin(2 * PI * burstFreq * t);
  float randomMod = 0.7 + (random(0, 60) / 100.0);
  
  float signal1 = sin(2 * PI * f1 * t) * 0.5;
  float signal2 = sin(2 * PI * f2 * t) * 0.3;
  float signal3 = sin(2 * PI * f3 * t) * 0.2;
  float combined = (signal1 + signal2 + signal3) * burstEnvelope * randomMod;
  
  float noise = gaussianRandom(0, 0.1);
  
  *x = (combined + noise) * amp * 0.8;
  *y = (combined * 0.7 + gaussianRandom(0, 0.08)) * amp * 0.6;
  *z = (abs(combined) + noise * 0.5) * amp;
}

float calculateIntensity() {
  if (trainPhase == "idle") return 0;
  
  unsigned long elapsed = millis() - trainStartTime;
  float intensity = 0;
  
  if (trainPhase == "approaching") {
    float progress = min(1.0f, elapsed / 8000.0f);
    intensity = pow(progress, 3) * 0.7;
    if (elapsed >= 8000) {
      trainPhase = "passing";
      trainStartTime = millis();
    }
  } else if (trainPhase == "passing") {
    intensity = 0.8 + (random(0, 20) / 100.0);
    if (elapsed >= 4000) {
      trainPhase = "departing";
      trainStartTime = millis();
    }
  } else if (trainPhase == "departing") {
    float progress = min(1.0f, elapsed / 6000.0f);
    intensity = (1 - pow(progress, 0.5)) * 0.9;
    if (elapsed >= 6000) {
      trainPhase = "idle";
      trainActive = false;
    }
  }
  
  return intensity;
}

// ============= WIFI SETUP =============
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("WiFi connection failed!");
  }
}

// ============= MQTT CALLBACK =============
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received [");
  Serial.print(topic);
  Serial.print("]: ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Handle train trigger commands
  if (String(topic) == "trainflow/command") {
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, message);
    
    if (!error) {
      String cmd = doc["command"].as<String>();
      if (cmd == "trigger_train" && !trainActive) {
        trainActive = true;
        trainDirection = doc["direction"].as<String>();
        trainSpeed = doc["speed"] | (60 + random(0, 60));
        trainPhase = "approaching";
        trainStartTime = millis();
        Serial.println("Train triggered!");
      }
    }
  }
}

// ============= MQTT RECONNECT =============
void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    
    String clientId = "ESP32-TrainFlow-" + String(random(1000, 9999));
    
    if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
      Serial.println("connected!");
      
      // Subscribe to command topic
      client.subscribe("trainflow/command");
      
      // Publish online status
      StaticJsonDocument<100> statusDoc;
      statusDoc["device"] = "ESP32";
      statusDoc["status"] = "online";
      statusDoc["ip"] = WiFi.localIP().toString();
      
      char statusBuffer[100];
      serializeJson(statusDoc, statusBuffer);
      client.publish(topic_status, statusBuffer);
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" - retrying in 5 seconds");
      delay(5000);
    }
  }
}

// ============= PUBLISH SENSOR DATA =============
void publishSensorData() {
  float xA, yA, zA, xB, yB, zB;
  float intensity = calculateIntensity();
  
  // Generate sensor data
  if (intensity > 0.01) {
    generateTrainSignal(&xA, &yA, &zA, intensity);
    // Sensor B with slight delay simulation
    generateTrainSignal(&xB, &yB, &zB, intensity * 0.95);
  } else {
    generateBaseline(&xA, &yA, &zA);
    generateBaseline(&xB, &yB, &zB);
  }
  
  float magnitudeA = sqrt(xA*xA + yA*yA + zA*zA);
  float magnitudeB = sqrt(xB*xB + yB*yB + zB*zB);
  
  // Create JSON for Sensor A
  StaticJsonDocument<300> docA;
  docA["timestamp"] = millis();
  docA["x"] = xA;
  docA["y"] = yA;
  docA["z"] = zA;
  docA["magnitude"] = magnitudeA;
  JsonObject voltageA = docA.createNestedObject("voltage");
  voltageA["x"] = rawToVoltage(xA);
  voltageA["y"] = rawToVoltage(yA);
  voltageA["z"] = rawToVoltage(zA);
  
  char bufferA[300];
  serializeJson(docA, bufferA);
  client.publish(topic_sensorA, bufferA);
  
  // Create JSON for Sensor B
  StaticJsonDocument<300> docB;
  docB["timestamp"] = millis();
  docB["x"] = xB;
  docB["y"] = yB;
  docB["z"] = zB;
  docB["magnitude"] = magnitudeB;
  JsonObject voltageB = docB.createNestedObject("voltage");
  voltageB["x"] = rawToVoltage(xB);
  voltageB["y"] = rawToVoltage(yB);
  voltageB["z"] = rawToVoltage(zB);
  
  char bufferB[300];
  serializeJson(docB, bufferB);
  client.publish(topic_sensorB, bufferB);
  
  // Publish train state
  StaticJsonDocument<150> stateDoc;
  stateDoc["phase"] = trainPhase;
  stateDoc["direction"] = trainDirection;
  stateDoc["speed"] = trainSpeed;
  stateDoc["isApproaching"] = (trainPhase == "approaching");
  
  char stateBuffer[150];
  serializeJson(stateDoc, stateBuffer);
  client.publish("trainflow/trainState", stateBuffer);
}

// ============= SETUP =============
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("  TrainFlow ESP32 Sensor Simulator");
  Serial.println("========================================");
  Serial.println();
  
  randomSeed(analogRead(0));
  
  // Setup WiFi
  setupWiFi();
  
  // Setup MQTT with TLS
  espClient.setCACert(root_ca);
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  client.setBufferSize(512);
  
  Serial.println("Setup complete! Starting sensor simulation...");
}

// ============= MAIN LOOP =============
void loop() {
  // Ensure MQTT connection
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Publish at 50Hz (every 20ms)
  unsigned long now = millis();
  if (now - lastPublishTime >= 20) {
    lastPublishTime = now;
    publishSensorData();
  }
  
  // Auto-trigger train every 30-60 seconds for demo
  static unsigned long lastAutoTrain = 0;
  if (!trainActive && (now - lastAutoTrain > 30000 + random(0, 30000))) {
    lastAutoTrain = now;
    trainActive = true;
    trainDirection = random(0, 2) ? "left-to-right" : "right-to-left";
    trainSpeed = 60 + random(0, 60);
    trainPhase = "approaching";
    trainStartTime = millis();
    Serial.println("Auto-triggered train simulation!");
  }
}
