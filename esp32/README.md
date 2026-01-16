# TrainFlow ESP32 Sensor Simulator

This folder contains the Arduino sketch for ESP32 that simulates ADXL335 accelerometer sensor data and sends it to HiveMQ Cloud via MQTT.

## Hardware Requirements
- ESP32 (any variant - DevKit, WROOM, etc.)
- USB cable for programming

## Software Requirements

### Arduino IDE Setup
1. Install [Arduino IDE](https://www.arduino.cc/en/software) (version 2.x recommended)

2. Add ESP32 Board Support:
   - Go to `File > Preferences`
   - Add this URL to "Additional Boards Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to `Tools > Board > Boards Manager`
   - Search for "ESP32" and install "esp32 by Espressif Systems"

3. Install Required Libraries (Tools > Manage Libraries):
   - **PubSubClient** by Nick O'Leary (for MQTT)
   - **ArduinoJson** by Benoit Blanchon (for JSON handling)

## Configuration

The sketch is pre-configured with:
- **WiFi SSID**: `SLT-4G_1EE41C`
- **WiFi Password**: `OnTheWay`
- **MQTT Broker**: HiveMQ Cloud (8102284b29c24b4eb40e06ac182d1130.s1.eu.hivemq.cloud)
- **MQTT Port**: 8883 (TLS)
- **MQTT Username**: `lathika`
- **MQTT Password**: `Lathika2002`

## Upload Instructions

1. Connect ESP32 to PC via USB (COM4)

2. Open Arduino IDE

3. Open the sketch:
   - `File > Open > TrainFlowSensorSimulator.ino`

4. Select Board:
   - `Tools > Board > ESP32 Arduino > ESP32 Dev Module`

5. Select Port:
   - `Tools > Port > COM4`

6. Upload:
   - Click the Upload button (→) or press `Ctrl+U`

7. Open Serial Monitor:
   - `Tools > Serial Monitor`
   - Set baud rate to `115200`

## What the Sketch Does

1. Connects to WiFi
2. Connects to HiveMQ Cloud using TLS
3. Publishes simulated sensor data every 20ms (50Hz):
   - `trainflow/sensor/A` - Sensor A accelerometer data
   - `trainflow/sensor/B` - Sensor B accelerometer data
   - `trainflow/trainState` - Current train simulation state
4. Simulates train approach/pass/depart every 30-60 seconds
5. Listens for commands on `trainflow/command` topic

## MQTT Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `trainflow/sensor/A` | ESP32 → Server | Sensor A data (x, y, z, magnitude, voltage) |
| `trainflow/sensor/B` | ESP32 → Server | Sensor B data |
| `trainflow/trainState` | ESP32 → Server | Train phase, direction, speed |
| `trainflow/status` | ESP32 → Server | Device online/offline status |
| `trainflow/command` | Server → ESP32 | Commands (trigger_train, etc.) |

## Data Format

### Sensor Data
```json
{
  "timestamp": 12345678,
  "x": 1234.56,
  "y": 789.12,
  "z": 456.78,
  "magnitude": 1567.89,
  "voltage": {
    "x": 1.65,
    "y": 1.67,
    "z": 1.63
  }
}
```

### Train State
```json
{
  "phase": "approaching|passing|departing|idle",
  "direction": "left-to-right|right-to-left",
  "speed": 85.5,
  "isApproaching": true
}
```

## Troubleshooting

### WiFi Connection Failed
- Check SSID and password are correct
- Ensure ESP32 is in range of WiFi router
- Try restarting the ESP32

### MQTT Connection Failed
- Verify HiveMQ credentials
- Check if HiveMQ Cloud cluster is running
- Ensure port 8883 is not blocked by firewall

### Upload Failed
- Ensure correct COM port is selected
- Try holding BOOT button while uploading
- Check USB cable (some cables are charge-only)

## Viewing Data on Web Dashboard

1. Start the backend server:
   ```bash
   cd server
   npm run dev
   ```

2. Open http://localhost:8080/trainflow-dashboard/sensors

3. The dashboard will show:
   - Simulated data (local) - always available
   - ESP32 data (MQTT) - when ESP32 is connected

4. Check MQTT status at: http://localhost:5000/api/mqtt/status
