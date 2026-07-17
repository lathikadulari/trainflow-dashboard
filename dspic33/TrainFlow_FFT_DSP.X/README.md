# ============================================================================
#  TrainFlow DSP Module — dsPIC33CK256MP502-I/SS
#  Real-Time FFT + Train Direction Detection
# ============================================================================

## Overview

This is the embedded firmware for the **dsPIC33CK256MP502-I/SS** DSP module,
responsible for offloading real-time FFT computation and train direction
detection from the ESP32/server. The dsPIC reads raw analog vibration data
directly from two ADXL335 accelerometers via its internal 12-bit ADC.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TrainFlow System Architecture                │
│                                                                 │
│  ADXL335 ×2 ──analog──► dsPIC33CK256MP502 ──UART──► ESP32     │
│  (Sensors)               │  ADC → FFT           │    (WiFi/MQTT)│
│                          │  Direction Detection  │              │
│                          │  100 MIPS DSP Engine   │              │
│                          └───────────────────────┘              │
│                                                                 │
│  ESP32 ──MQTT──► Server ──WebSocket──► Dashboard               │
└─────────────────────────────────────────────────────────────────┘
```

## Hardware Connections

### dsPIC33CK256MP502 Pin Assignments

| Pin    | Function       | Connection             |
|--------|----------------|------------------------|
| RA0/AN0| ADC Channel 0  | Sensor 1 X-axis (ADXL335 XOUT) |
| RA1/AN1| ADC Channel 1  | Sensor 1 Z-axis (ADXL335 ZOUT) |
| RB0/AN2| ADC Channel 2  | Sensor 2 X-axis (ADXL335 XOUT) |
| RB1/AN3| ADC Channel 3  | Sensor 2 Z-axis (ADXL335 ZOUT) |
| RB7    | UART1 TX       | ESP32 RX (GPIO16)      |
| RB8    | UART1 RX       | ESP32 TX (GPIO17)      |
| RB15   | Digital Out    | Heartbeat LED          |
| VDD    | Power          | 3.3V                   |
| VSS    | Ground         | GND                    |

### ADXL335 Wiring

```
ADXL335 #1 (Right Rail)         ADXL335 #2 (Left Rail)
  XOUT ──► RA0/AN0                XOUT ──► RB0/AN2
  ZOUT ──► RA1/AN1                ZOUT ──► RB1/AN3
  VCC  ──► 3.3V                   VCC  ──► 3.3V
  GND  ──► GND                    GND  ──► GND
```

### UART to ESP32

```
dsPIC RB7 (TX) ──────► ESP32 GPIO16 (RX2)
dsPIC RB8 (RX) ◄────── ESP32 GPIO17 (TX2)
GND ─────────────────── GND (common ground)
```

> **Important**: Both devices operate at 3.3V logic — no level shifting needed.

## Signal Processing Pipeline

```
1. ADC Sampling (Timer1 ISR @ 500 Hz)
   ├── Read 4 channels: S1_X, S1_Z, S2_X, S2_Z
   ├── Convert ADC raw → g-force (float)
   ├── Store in 256-sample circular buffers
   └── Update direction detection (every sample)

2. FFT Processing (main loop, every 512 ms)
   ├── Subtract DC offset (mean removal)
   ├── Apply Hanning window
   ├── Convert to Q1.15 fractional format
   ├── 256-point Radix-2 FFT (DSP engine)
   ├── Bit-reverse output ordering
   ├── Compute magnitude spectrum
   └── Extract top-5 frequency peaks

3. Direction Detection (continuous @ 500 Hz)
   ├── Adaptive baseline (EMA) during quiet
   ├── Combined magnitude onset (consecutive)
   ├── Rolling RMS onset detection
   └── Weighted voting → direction result
```

## UART Output Protocol

All output is **newline-delimited JSON** at **115200 baud, 8N1**.

### FFT Result
```json
{
  "type": "fft",
  "sensor": 1,
  "axis": "x",
  "peaks": [
    {"hz": 12.5, "mag": 0.450},
    {"hz": 25.0, "mag": 0.230}
  ],
  "rms": 0.1200
}
```

### Direction Detection Result
```json
{
  "type": "dir",
  "direction": "left_to_right",
  "confidence": 85,
  "delay_ms": 42,
  "first": "sensor1",
  "method": "combined_rms"
}
```

### Heartbeat (every 2 seconds)
```json
{
  "type": "hb",
  "uptime": 12345,
  "s1_bl": 500,
  "s2_bl": 500,
  "vib": false,
  "dir_det": false
}
```

### Direction Reset (after 30s quiet period)
```json
{
  "type": "dir_reset"
}
```

## Build Instructions

### Prerequisites
- **MPLAB X IDE** v6.05+ ([download](https://www.microchip.com/mplab/mplab-x-ide))
- **XC16 Compiler** v2.10+ ([download](https://www.microchip.com/mplab/compilers))
- **dsPIC33CK DFP** (Device Family Pack) — install via MPLAB X Pack Manager

### Setup
1. Open MPLAB X IDE
2. `File → Open Project` → Select `TrainFlow_FFT_DSP.X` folder
3. Set device: `dsPIC33CK256MP502`
4. Set compiler: `XC16 (v2.10)`

### Compiler Settings
| Setting           | Value                    |
|-------------------|--------------------------|
| Optimization      | `-O1` (balanced)         |
| DSP Library       | Link `libdsp-elf.a`     |
| Linker Script     | `p33CK256MP502.gld`     |
| Heap Size         | `512` bytes              |
| Stack Size        | `2048` bytes             |

### Build & Program
```bash
# Build
make -f nbproject/Makefile-default.mk

# Program via PICkit 4 / SNAP
make -f nbproject/Makefile-default.mk program
```

Or use MPLAB X:
- **Build**: `Production → Build Main Project` (F11)
- **Program**: `Production → Make and Program Device` (Ctrl+Shift+F5)

## Specifications

| Parameter              | Value                    |
|------------------------|--------------------------|
| Clock Speed            | 100 MIPS (200 MHz Fosc)  |
| ADC Resolution         | 12-bit                   |
| Sample Rate            | 500 Hz per channel       |
| FFT Window Size        | 256 points               |
| FFT Update Rate        | ~1.95 Hz (every 512 ms)  |
| Frequency Resolution   | 1.953 Hz/bin             |
| Max Detectable Freq    | 250 Hz (Nyquist)         |
| Direction Latency      | <1 second typical        |
| UART Baud Rate         | 115200                   |
| Power Supply           | 3.3V                     |
| Current Draw           | ~40 mA typical           |

## Direction Detection Algorithm

The algorithm mirrors the server-side `DirectionDetector V2` — validated against
3 confirmed real train events at Makumbura station.

### Voting Methods
| Method              | Weight | Description                          |
|---------------------|--------|--------------------------------------|
| Combined RMS Onset  | 4      | Most reliable — rolling RMS threshold|
| Magnitude Onset     | 2      | Consecutive above-threshold samples  |

### How It Works
1. **Baseline Learning**: During quiet periods, EMA tracks the noise floor
2. **Vibration Detect**: Combined X+Z magnitude exceeds 0.08g threshold
3. **Onset Timing**: Records which sensor crosses threshold first
4. **Weighted Vote**: Earlier sensor determines approach direction
5. **Confidence**: Proportional to vote margin (0-100%)

## Files

```
dspic33/TrainFlow_FFT_DSP.X/
├── main.c              ← Main firmware (FFT + direction + UART)
└── README.md           ← This file
```

## Integration with ESP32

The ESP32 at Makumbura Station receives FFT and direction data over UART2
and forwards it via MQTT to the server/dashboard. On the ESP32 side, parse
the UART JSON stream and publish to:

| MQTT Topic              | Data Source    |
|--------------------------|---------------|
| `makumbura/fft`          | FFT peaks+RMS |
| `makumbura/direction`    | Direction     |
| `makumbura/dsp_status`   | Heartbeats    |

## Future Improvements

- [ ] Add Y-axis channels (currently X+Z only, matching sensor setup)
- [ ] Overlapping FFT windows (50% overlap for better time resolution)
- [ ] Frequency-domain direction features (spectral energy comparison)
- [ ] DMA-based ADC for zero-CPU-overhead sampling
- [ ] SPI interface option for higher-speed ESP32 communication
- [ ] Store configuration in EEPROM (thresholds, sample rate)
