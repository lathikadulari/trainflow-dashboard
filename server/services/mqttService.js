const mqtt = require('mqtt');
const MqttRecord = require('../models/MqttRecord');
const DirectionDetector = require('./directionDetector');

// ── Direction detector instance (one per station) ────────────
let directionDetector = new DirectionDetector('Makumbura');

// ── Sri Lankan Time (IST UTC+5:30) helper ───────────────────
function toIST(date) {
    const d = date || new Date();
    return d.toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }) + '.' + String(d.getMilliseconds()).padStart(3, '0') + ' IST';
}

let client = null;
let isConnected = false;

// Store for train data received via MQTT
let trainData = {};

// Callback for when messages are received
let messageCallback = null;

// ESP32 heartbeat tracking
let lastEsp32DataTime = 0;
const ESP32_TIMEOUT_MS = 5000; // 5 seconds timeout

// Check if ESP32 is online (received data within timeout)
const getEsp32Status = () => {
    if (lastEsp32DataTime === 0) return 'offline';
    const timeSinceLastData = Date.now() - lastEsp32DataTime;
    return timeSinceLastData < ESP32_TIMEOUT_MS ? 'online' : 'offline';
};

// Sensor data buffers for FFT computation
const sensorBuffer = {
    sensorA: [],
    sensorB: []
};
const maxBufferSize = 512;
const fftWindowSize = 256;
const MQTT_SAMPLE_RATE_HZ = Number(process.env.MQTT_SAMPLE_RATE_HZ || 10);
const FFT_MIN_HZ = Number(process.env.MQTT_FFT_MIN_HZ || 0.05);

const smoothSpectrum = (points, radius = 1) => {
    if (!Array.isArray(points) || points.length === 0 || radius <= 0) return points;

    return points.map((point, index) => {
        let sum = 0;
        let count = 0;

        for (let i = index - radius; i <= index + radius; i++) {
            if (i < 0 || i >= points.length) continue;
            sum += points[i].magnitude;
            count += 1;
        }

        return {
            frequency: point.frequency,
            magnitude: count > 0 ? sum / count : point.magnitude,
        };
    });
};

// True FFT computation using Radix-2 Cooley-Tukey algorithm
const computeFFT = (signal, sampleRate = MQTT_SAMPLE_RATE_HZ) => {
    const N = signal.length;
    if (N < 16) return [];

    // Pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));

    // Arrays for real and imaginary parts
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    // Remove DC bias and apply Hann window to reduce spectral leakage.
    const mean = signal.reduce((sum, value) => sum + value, 0) / N;
    for (let i = 0; i < N; i++) {
        const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
        real[i] = (signal[i] - mean) * hann;
    }

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < paddedLength - 1; i++) {
        if (i < j) {
            let temp = real[i];
            real[i] = real[j];
            real[j] = temp;
        }
        let m = paddedLength >> 1;
        while (m <= j) {
            j -= m;
            m >>= 1;
        }
        j += m;
    }

    // Cooley-Tukey decimation-in-time radix-2 FFT
    for (let i = 1; i < paddedLength; i <<= 1) {
        const step = i << 1;
        const theta = -Math.PI / i;
        const wTemp = Math.sin(0.5 * theta);
        const wR = -2.0 * wTemp * wTemp;
        const wI = Math.sin(theta);

        for (let m = 0; m < paddedLength; m += step) {
            let wr = 1.0;
            let wi = 0.0;
            for (let k = 0; k < i; k++) {
                const idx1 = m + k;
                const idx2 = m + k + i;
                const tr = wr * real[idx2] - wi * imag[idx2];
                const ti = wr * imag[idx2] + wi * real[idx2];
                real[idx2] = real[idx1] - tr;
                imag[idx2] = imag[idx1] - ti;
                real[idx1] += tr;
                imag[idx1] += ti;

                const wtr = wr * wR - wi * wI + wr;
                const wti = wi * wR + wr * wI + wi;
                wr = wtr;
                wi = wti;
            }
        }
    }

    const results = [];

    const nyquist = sampleRate / 2;
    const maxHz = Number(process.env.MQTT_FFT_MAX_HZ || nyquist);
    const minHz = Math.max(0, FFT_MIN_HZ);
    const clampedMaxHz = Math.min(maxHz, nyquist);

    // Calculate magnitudes for positive frequencies only and keep physically valid band.
    for (let k = 1; k < paddedLength / 2; k++) {
        const magnitude = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / paddedLength;
        const frequency = (k * sampleRate) / paddedLength;

        if (frequency >= minHz && frequency <= clampedMaxHz) {
            results.push({ frequency: Number(frequency.toFixed(4)), magnitude });
        }
    }

    // Light 3-bin moving average smoothing for visually stable real-time FFT.
    return smoothSpectrum(results, 1);
};

// Compute FFT for all axes
const computeAllFFT = () => {
    if (sensorBuffer.sensorA.length < fftWindowSize) return null;

    const extractAxis = (data, axis) => data.slice(-fftWindowSize).map(d => d[axis] || 0);

    // Check for significant signal
    const windowA = sensorBuffer.sensorA.slice(-fftWindowSize);
    const windowB = sensorBuffer.sensorB.slice(-fftWindowSize);
    const maxMagnitudeA = Math.max(...windowA.map(d => Math.abs(d.magnitude || 0)));
    const maxMagnitudeB = Math.max(...windowB.map(d => Math.abs(d.magnitude || 0)));

    const signalThreshold = 50; // lowered from 1500 for higher sensitivity to small signals

    const computeIfSignificant = (data, maxMag) => {
        if (maxMag < signalThreshold) {
            return { x: [], y: [], z: [] };
        }
        return {
            x: computeFFT(extractAxis(data, 'x')),
            y: computeFFT(extractAxis(data, 'y')),
            z: computeFFT(extractAxis(data, 'z')),
        };
    };

    return {
        sensorA: computeIfSignificant(sensorBuffer.sensorA, maxMagnitudeA),
        sensorB: computeIfSignificant(sensorBuffer.sensorB, maxMagnitudeB),
    };
};

const connectMQTT = () => {
    return new Promise((resolve, reject) => {
        // MQTT connection options loaded inside function to ensure env vars are available.
        const mqttPort = parseInt(process.env.MQTT_PORT, 10) || 1883;
        const mqttProtocol = process.env.MQTT_PROTOCOL || (mqttPort === 8883 ? 'mqtts' : 'mqtt');
        const rejectUnauthorized = process.env.MQTT_REJECT_UNAUTHORIZED !== 'false';

        const options = {
            host: process.env.MQTT_HOST,
            port: mqttPort,
            protocol: mqttProtocol,
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            reconnectPeriod: 15000 // Retry every 15 seconds instead of every 1 second
        };

        if (mqttProtocol === 'mqtts') {
            options.rejectUnauthorized = rejectUnauthorized;
        }

        console.log('Connecting to MQTT broker...');
        console.log('Host:', options.host);
        console.log('Port:', options.port);
        console.log('Protocol:', options.protocol);
        console.log('Username:', options.username);

        client = mqtt.connect(options);

        client.on('connect', () => {
            console.log('Connected to MQTT broker successfully!');
            isConnected = true;

            // Subscribe to train-related topics
            client.subscribe('trainflow/#', (err) => {
                if (err) {
                    console.error('Subscription error:', err);
                } else {
                    console.log('Subscribed to trainflow/# topics');
                }
            });
            client.subscribe('adxl335/#', (err) => {
                if (err) {
                    console.error('Subscription adxl335 error:', err);
                } else {
                    console.log('Subscribed to adxl335/# topics');
                }
            });
            client.subscribe('makumbura/#', (err) => {
                if (err) {
                    console.error('Subscription makumbura error:', err);
                } else {
                    console.log('Subscribed to makumbura/# topics');
                }
            });
            client.subscribe('sensorlab/#', (err) => {
                if (err) {
                    console.error('Subscription sensorlab error:', err);
                } else {
                    console.log('Subscribed to sensorlab/# topics');
                }
            });

            resolve(client);
        });

        client.on('error', (error) => {
            console.error('MQTT Connection error:', error.message || error);
            isConnected = false;
        });

        client.on('close', () => {
            console.log('MQTT Connection closed');
            isConnected = false;
        });

        client.on('reconnect', () => {
            console.log('Attempting to reconnect to MQTT (every 15s)...');
        });

        client.on('message', (topic, message) => {
            const messageStr = message.toString();

            // Parse and store train data
            try {
                const data = JSON.parse(messageStr);

                trainData[topic] = {
                    data: data,
                    timestamp: new Date().toISOString()
                };

                // ── Persist to MongoDB (fire-and-forget) ────────
                const parts = topic.split('/');
                const station = parts[0] || null;   // e.g. "makumbura", "trainflow", "sensorlab"
                const sensorId = parts[1] || null;   // e.g. "sensor1", "sensor2", "status"
                MqttRecord.create({
                    topic,
                    payload: data,
                    rawPayload: messageStr,
                    station,
                    sensorId,
                    receivedAt: new Date(),
                    localTime: toIST()
                }).catch(err => console.error('MqttRecord save error:', err.message));

                let mappedTopic = topic;
                let mappedData = data;

                if (topic === 'adxl335/sensor1' && data) {
                    mappedTopic = 'trainflow/sensor/A';
                    const yG = data.y_g ?? data.x_g ?? 0;
                    const zG = data.z_g ?? 0;
                    mappedData = {
                        timestamp: Date.now(),
                        x: 0,
                        y: yG * 1000,
                        z: zG * 1000,
                        magnitude: Math.sqrt(yG ** 2 + zG ** 2) * 1000,
                        voltage: { x: 1.65, y: data.y_v ?? data.x_v ?? 1.65, z: data.z_v ?? 1.65 }
                    };
                } else if (topic === 'adxl335/sensor2' && data) {
                    mappedTopic = 'trainflow/sensor/B';
                    const yG = data.y_g ?? data.x_g ?? 0;
                    const zG = data.z_g ?? 0;
                    mappedData = {
                        timestamp: Date.now(),
                        x: 0,
                        y: yG * 1000,
                        z: zG * 1000,
                        magnitude: Math.sqrt(yG ** 2 + zG ** 2) * 1000,
                        voltage: { x: 1.65, y: data.y_v ?? data.x_v ?? 1.65, z: data.z_v ?? 1.65 }
                    };
                } else if (topic === 'makumbura/sensor1' && data) {
                    // sensor1 = Right side sensor (A0=Y, A1=Z) → maps to right panel (B)
                    mappedTopic = 'trainflow/sensor/B';
                    const yG = data.y_g ?? data.x_g ?? 0;
                    const zG = data.z_g ?? 0;
                    mappedData = {
                        timestamp: Date.now(),
                        t_us: data.t_us ?? null,
                        x: 0,
                        y: yG * 1000,
                        z: zG * 1000,
                        magnitude: Math.sqrt(yG ** 2 + zG ** 2) * 1000,
                        voltage: { x: 1.65, y: data.y_v ?? data.x_v ?? 1.65, z: data.z_v ?? 1.65 }
                    };

                    // ── Feed to direction detector ──
                    const dirResult = directionDetector.onSensorData('sensor1', data);
                    if (dirResult) {
                        // Broadcast direction result via message callback
                        if (messageCallback) {
                            messageCallback('trainflow/direction', {
                                type: 'direction_detected',
                                ...dirResult,
                                timestamp: Date.now()
                            });
                        }
                    }
                } else if (topic === 'makumbura/sensor2' && data) {
                    // sensor2 = Left side sensor (A2=Y, A3=Z) → maps to left panel (A)
                    mappedTopic = 'trainflow/sensor/A';
                    const yG = data.y_g ?? data.x_g ?? 0;
                    const zG = data.z_g ?? 0;
                    mappedData = {
                        timestamp: Date.now(),
                        t_us: data.t_us ?? null,
                        x: 0,
                        y: yG * 1000,
                        z: zG * 1000,
                        magnitude: Math.sqrt(yG ** 2 + zG ** 2) * 1000,
                        voltage: { x: 1.65, y: data.y_v ?? data.x_v ?? 1.65, z: data.z_v ?? 1.65 }
                    };

                    // ── Feed to direction detector ──
                    directionDetector.onSensorData('sensor2', data);
                } else if (topic === 'sensorlab/sensor1' && data) {
                    mappedTopic = 'sensorlab/sensor1';

                    const xMilliG = typeof data.x === 'number' ? data.x : (data.x_g || 0) * 1000;
                    const yMilliG = typeof data.y === 'number' ? data.y : (data.y_g || 0) * 1000;
                    const zMilliG = typeof data.z === 'number' ? data.z : (data.z_g || 0) * 1000;

                    mappedData = {
                        timestamp: Date.now(),
                        x: xMilliG,
                        y: yMilliG,
                        z: zMilliG,
                        magnitude: Math.sqrt(xMilliG ** 2 + yMilliG ** 2 + zMilliG ** 2),
                        voltage: {
                            x: data.x_v || 1.65,
                            y: data.y_v || 1.65,
                            z: data.z_v || 1.65,
                        },
                    };
                }

                // Buffer sensor data for FFT computation
                if (mappedTopic === 'trainflow/sensor/A' && mappedData) {
                    lastEsp32DataTime = Date.now(); // Update heartbeat
                    sensorBuffer.sensorA.push(mappedData);
                    if (sensorBuffer.sensorA.length > maxBufferSize) {
                        sensorBuffer.sensorA.shift();
                    }
                } else if (mappedTopic === 'trainflow/sensor/B' && mappedData) {
                    lastEsp32DataTime = Date.now(); // Update heartbeat
                    sensorBuffer.sensorB.push(mappedData);
                    if (sensorBuffer.sensorB.length > maxBufferSize) {
                        sensorBuffer.sensorB.shift();
                    }
                } else if (mappedTopic === 'sensorlab/sensor1' && mappedData) {
                    lastEsp32DataTime = Date.now(); // Update heartbeat for single-sensor setup
                    // Reuse sensorA FFT pipeline for the one-sensor lab setup.
                    sensorBuffer.sensorA.push(mappedData);
                    if (sensorBuffer.sensorA.length > maxBufferSize) {
                        sensorBuffer.sensorA.shift();
                    }
                }

                // Call the message callback if set
                if (messageCallback) {
                    messageCallback(mappedTopic, mappedData);
                }
            } catch (e) {
                // If not JSON, store as string
                trainData[topic] = {
                    data: messageStr,
                    timestamp: new Date().toISOString()
                };

                // ── Persist non-JSON messages too ────────
                MqttRecord.create({
                    topic,
                    payload: { raw: messageStr },
                    rawPayload: messageStr,
                    station: topic.split('/')[0] || null,
                    sensorId: topic.split('/')[1] || null,
                    receivedAt: new Date(),
                    localTime: toIST()
                }).catch(err => console.error('MqttRecord save error (non-JSON):', err.message));
            }
        });

        // Set a timeout for initial connection
        setTimeout(() => {
            if (!isConnected) {
                console.log('MQTT connection timeout - will keep trying in background');
                resolve(null);
            }
        }, 10000);
    });
};

// Publish a message to a topic
const publishMessage = (topic, message) => {
    if (!client || !isConnected) {
        console.error('MQTT client not connected');
        return false;
    }

    const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
    client.publish(topic, messageStr);
    console.log(`Published to ${topic}: ${messageStr}`);
    return true;
};

// Subscribe to a specific topic
const subscribeToTopic = (topic) => {
    if (!client || !isConnected) {
        console.error('MQTT client not connected');
        return false;
    }

    client.subscribe(topic, (err) => {
        if (err) {
            console.error(`Failed to subscribe to ${topic}:`, err);
            return false;
        }
        console.log(`Subscribed to ${topic}`);
    });
    return true;
};

// Set callback for message handling
const setMessageCallback = (callback) => {
    messageCallback = callback;
};

// Get current train data
const getTrainData = () => {
    return trainData;
};

// Check connection status
const getConnectionStatus = () => {
    return isConnected;
};

// Disconnect from MQTT
const disconnect = () => {
    if (client) {
        client.end();
        isConnected = false;
        console.log('Disconnected from MQTT');
    }
};

// ── Direction detector access ───────────────────────────────
const getDirectionDetector = () => directionDetector;
const resetDirectionDetector = () => {
    directionDetector = new DirectionDetector('Makumbura');
    return directionDetector;
};

module.exports = {
    connectMQTT,
    publishMessage,
    subscribeToTopic,
    setMessageCallback,
    getTrainData,
    getConnectionStatus,
    getEsp32Status,
    computeAllFFT,
    computeFFT,
    disconnect,
    toIST,
    getDirectionDetector,
    resetDirectionDetector
};
