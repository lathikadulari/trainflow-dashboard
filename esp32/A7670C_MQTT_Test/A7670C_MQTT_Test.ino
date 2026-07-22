#define RX_PIN 26  // ESP32 RX pin (module TX)
#define TX_PIN 27  // ESP32 TX pin (module RX)

// EC2 MQTT broker credentials
String mqtt_server = "ec2-13-235-248-117.ap-south-1.compute.amazonaws.com";
String mqtt_port = "8883";
String mqtt_user = "trainflow";
String mqtt_pass = "Trainflow@2026!";
String mqtt_topic = "trainflow/sensor/data";
const char* mqttHosts[] = {
  "ec2-13-235-248-117.ap-south-1.compute.amazonaws.com",
  "13.235.248.117"
};
const int mqttHostsCount = 2;
const char* mqttPorts[] = {"443", "8883", "1883"};
const int mqttPortsCount = 3;

// 5 Hz publish interval (200 ms)
unsigned long lastPublishTime = 0;
const long publishInterval = 200;
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectIntervalMs = 10000;

bool isConnected = false;

String sendATCommand(String command, String expected_response, int timeout);
bool waitFor(String expected, int timeout);
void publishMQTT(String topic, String payload);
bool connectMQTTWithFallback();
bool ensureNetworkRegistration();
void resetMQTTStack();

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN);
  delay(3000);

  Serial.println("======================================");
  Serial.println(" A7670C Millisecond Streamer (5Hz)    ");
  Serial.println("======================================");

  if (!ensureNetworkRegistration()) {
    Serial.println("Could not register on network now. Will retry in loop.");
    return;
  }

  Serial.println("\n--- Cleaning old MQTT sessions ---");
  resetMQTTStack();

  isConnected = connectMQTTWithFallback();
}

void loop() {
  if (!isConnected && millis() - lastReconnectAttempt >= reconnectIntervalMs) {
    lastReconnectAttempt = millis();

    if (ensureNetworkRegistration()) {
      resetMQTTStack();
      isConnected = connectMQTTWithFallback();
    }
  }

  if (isConnected && (millis() - lastPublishTime >= publishInterval)) {
    lastPublishTime = millis();

    float fakeTemp = 20.0 + (random(0, 100) / 10.0);
    int fakeHum = random(40, 60);
    String payload = "{\"t\":" + String(fakeTemp, 1) + ",\"h\":" + String(fakeHum) + "}";

    publishMQTT(mqtt_topic, payload);
  }

  if (Serial.available()) {
    Serial2.print(Serial.readString());
  }
  if (Serial2.available()) {
    Serial.print(Serial2.readString());
  }
}

void resetMQTTStack() {
  // Best-effort cleanup of any stale session/client handles.
  sendATCommand("AT+CMQTTDISC=0,60", "OK", 2000);
  sendATCommand("AT+CMQTTREL=0", "OK", 2000);
  sendATCommand("AT+CMQTTSTOP", "OK", 3000);
  delay(400);

  // Fresh MQTT stack boot.
  sendATCommand("AT+CMQTTSTART", "OK", 4000);
  delay(300);
  sendATCommand("AT+CMQTTACCQ=0,\"ESP32_TrainFlow_Client\",1", "OK", 4000);
  delay(300);
}

bool ensureNetworkRegistration() {
  Serial.println("\n--- Waiting for 4G Network ---");
  for (int i = 0; i < 20; i++) {
    String status = sendATCommand("AT+CEREG?", "OK", 1500);
    if (status.indexOf("+CEREG: 0,1") != -1 || status.indexOf("+CEREG: 0,5") != -1) {
      Serial.println("4G Network Connected");
      delay(1500);
      return true;
    }
    Serial.println("Still searching for network...");
    delay(1000);
  }
  return false;
}

bool connectMQTTWithFallback() {
  Serial.println("\n--- Connecting to EC2 broker ---");
  for (int h = 0; h < mqttHostsCount; h++) {
    mqtt_server = mqttHosts[h];
    for (int i = 0; i < mqttPortsCount; i++) {
      mqtt_port = mqttPorts[i];
      Serial.println("Trying " + mqtt_server + ":" + mqtt_port + "...");

      String connectCmd = "AT+CMQTTCONNECT=0,\"tcp://" + mqtt_server + ":" + mqtt_port + "\",60,1,\"" + mqtt_user + "\",\"" + mqtt_pass + "\"";
      String response = sendATCommand(connectCmd, "OK", 15000);

      if (response.indexOf("+CMQTTCONNECT: 0,0") != -1) {
        Serial.println("Connected to EC2 MQTT broker at " + mqtt_server + ":" + mqtt_port);
        return true;
      }

      Serial.println("Connect failed at " + mqtt_server + ":" + mqtt_port);
      // Keep the stack clean between port attempts.
      sendATCommand("AT+CMQTTDISC=0,60", "OK", 2000);
      delay(800);
    }
  }

  Serial.println("Failed to connect to EC2 MQTT broker on all ports.");
  return false;
}

void publishMQTT(String topic, String payload) {
  unsigned long totalStart = millis();

  Serial2.print("AT+CMQTTTOPIC=0,");
  Serial2.println(topic.length());
  if (waitFor(">", 500)) {
    Serial2.print(topic);
    waitFor("OK", 500);
  } else {
    Serial.println("Topic setup failed (module busy)");
    return;
  }

  Serial2.print("AT+CMQTTPAYLOAD=0,");
  Serial2.println(payload.length());
  if (waitFor(">", 500)) {
    Serial2.print(payload);
    waitFor("OK", 500);
  } else {
    Serial.println("Payload setup failed (module busy)");
    return;
  }

  Serial2.println("AT+CMQTTPUB=0,0,60");
  if (waitFor("+CMQTTPUB: 0,0", 2000)) {
    unsigned long totalTime = millis() - totalStart;
    Serial.println("Sent: " + payload + " | AT sequence: " + String(totalTime) + "ms");
  } else {
    Serial.println("Publish timeout");
  }
}

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
