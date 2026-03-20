const mqtt = require('mqtt');

let client = null;
let isConnected = false;

// Store for train data received via MQTT
let trainData = {};

// Callback for when messages are received
let messageCallback = null;

// ESP32 heartbeat tracking
let lastEsp32DataTime = 0;
const ESP32_TIMEOUT_MS = 5000; // 5 seconds timeout

// Track if we've already logged certain messages to avoid spam
let hasLoggedInitialConnection = false;
let hasLoggedConnectionError = false;
let hasLoggedTimeout = false;

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

// True FFT computation using Radix-2 Cooley-Tukey algorithm
const computeFFT = (signal, sampleRate = 50) => {
    const N = signal.length;
    if (N < 16) return [];

    // Pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));

    // Arrays for real and imaginary parts
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    for (let i = 0; i < N; i++) {
        real[i] = signal[i];
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

    // Calculate magnitudes and apply bandpass filter (positive frequencies only)
    for (let k = 0; k < paddedLength / 2; k++) {
        const magnitude = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]) / paddedLength;
        const frequency = (k * sampleRate) / paddedLength;

        // Filter to 10-250 Hz range (relevant for train vibration)
        if (frequency >= 10 && frequency <= 250) {
            results.push({ frequency: Math.round(frequency), magnitude });
        }
    }

    return results;
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
    return new Promise((resolve) => {
        // HiveMQ Cloud connection options - loaded inside function to ensure env vars are available
        const options = {
            host: process.env.MQTT_HOST,
            port: parseInt(process.env.MQTT_PORT) || 8883,
            protocol: 'mqtts',
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            rejectUnauthorized: true,
            // Resilient reconnection settings
            reconnectPeriod: 5000,      // Try to reconnect every 5 seconds
            connectTimeout: 10000,       // 10 second connection timeout
            keepalive: 60               // Keep alive ping every 60 seconds
        };

        if (!hasLoggedInitialConnection) {
            console.log('MQTT: Initializing connection to HiveMQ Cloud...');
            console.log('MQTT: Host:', options.host);
            console.log('MQTT: Will retry silently in background if unavailable');
            hasLoggedInitialConnection = true;
        }

        client = mqtt.connect(options);

        client.on('connect', () => {
            console.log('MQTT: Connected to HiveMQ Cloud successfully!');
            isConnected = true;
            // Reset error logging flags on successful connection
            hasLoggedConnectionError = false;
            hasLoggedTimeout = false;

            // Subscribe to train-related topics
            client.subscribe('trainflow/#', (err) => {
                if (err) {
                    console.error('MQTT: Subscription error:', err.message);
                } else {
                    console.log('MQTT: Subscribed to trainflow/# topics');
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

            resolve(client);
        });

        client.on('error', (error) => {
            // Only log the first error, then stay silent to avoid spam
            if (!hasLoggedConnectionError) {
                console.log('MQTT: Connection unavailable - will keep retrying silently');
                hasLoggedConnectionError = true;
            }
            isConnected = false;
            // Don't reject - let the client keep trying to reconnect
        });

        client.on('close', () => {
            if (isConnected) {
                console.log('MQTT: Connection closed - will attempt to reconnect');
            }
            isConnected = false;
        });

        client.on('reconnect', () => {
            // Silent reconnection - no logging to avoid spam
        });

        client.on('offline', () => {
            // Silent offline handling
            isConnected = false;
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

                let mappedTopic = topic;
                let mappedData = data;

                if (topic === 'adxl335/sensor1' && data) {
                    mappedTopic = 'trainflow/sensor/A';
                    mappedData = {
                        timestamp: Date.now(),
                        x: (data.x_g || 0) * 1000,
                        y: 0,
                        z: (data.z_g || 0) * 1000,
                        magnitude: Math.sqrt((data.x_g || 0) ** 2 + (data.z_g || 0) ** 2) * 1000,
                        voltage: { x: data.x_v || 1.65, y: 1.65, z: data.z_v || 1.65 }
                    };
                } else if (topic === 'adxl335/sensor2' && data) {
                    mappedTopic = 'trainflow/sensor/B';
                    mappedData = {
                        timestamp: Date.now(),
                        x: (data.x_g || 0) * 1000,
                        y: 0,
                        z: (data.z_g || 0) * 1000,
                        magnitude: Math.sqrt((data.x_g || 0) ** 2 + (data.z_g || 0) ** 2) * 1000,
                        voltage: { x: data.x_v || 1.65, y: 1.65, z: data.z_v || 1.65 }
                    };
                } else if (topic === 'makumbura/sensor1' && data) {
                    mappedTopic = 'trainflow/sensor/A';
                    mappedData = {
                        timestamp: Date.now(),
                        x: (data.x_g || 0) * 1000,
                        y: 0,
                        z: (data.z_g || 0) * 1000,
                        magnitude: Math.sqrt((data.x_g || 0) ** 2 + (data.z_g || 0) ** 2) * 1000,
                        voltage: { x: data.x_v || 1.65, y: 1.65, z: data.z_v || 1.65 }
                    };
                } else if (topic === 'makumbura/sensor2' && data) {
                    mappedTopic = 'trainflow/sensor/B';
                    mappedData = {
                        timestamp: Date.now(),
                        x: (data.x_g || 0) * 1000,
                        y: 0,
                        z: (data.z_g || 0) * 1000,
                        magnitude: Math.sqrt((data.x_g || 0) ** 2 + (data.z_g || 0) ** 2) * 1000,
                        voltage: { x: data.x_v || 1.65, y: 1.65, z: data.z_v || 1.65 }
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
            }
        });

        // Set a timeout for initial connection - resolve anyway to not block server
        setTimeout(() => {
            if (!isConnected) {
                if (!hasLoggedTimeout) {
                    console.log('MQTT: Initial connection timeout - server will continue, MQTT retries in background');
                    hasLoggedTimeout = true;
                }
                resolve(null); // Resolve with null, don't reject
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

module.exports = {
    connectMQTT,
    publishMessage,
    subscribeToTopic,
    setMessageCallback,
    getTrainData,
    getConnectionStatus,
    getEsp32Status,
    computeAllFFT,
    disconnect
};
