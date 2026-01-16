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

// DFT computation (same algorithm as sensorSimulator)
const computeFFT = (signal, sampleRate = 50) => {
    const N = signal.length;
    if (N < 16) return [];

    // Pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = [...signal];
    while (padded.length < paddedLength) padded.push(0);

    const results = [];

    // DFT computation
    for (let k = 0; k < paddedLength / 2; k++) {
        let realSum = 0, imagSum = 0;

        for (let n = 0; n < paddedLength; n++) {
            const angle = (2 * Math.PI * k * n) / paddedLength;
            realSum += padded[n] * Math.cos(angle);
            imagSum -= padded[n] * Math.sin(angle);
        }

        const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / paddedLength;
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

    const signalThreshold = 1500;

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
        // HiveMQ Cloud connection options - loaded inside function to ensure env vars are available
        const options = {
            host: process.env.MQTT_HOST,
            port: parseInt(process.env.MQTT_PORT) || 8883,
            protocol: 'mqtts',
            username: process.env.MQTT_USERNAME,
            password: process.env.MQTT_PASSWORD,
            rejectUnauthorized: true
        };

        console.log('Connecting to HiveMQ Cloud...');
        console.log('Host:', options.host);
        console.log('Port:', options.port);
        console.log('Username:', options.username);

        client = mqtt.connect(options);

        client.on('connect', () => {
            console.log('Connected to HiveMQ Cloud successfully!');
            isConnected = true;

            // Subscribe to train-related topics
            client.subscribe('trainflow/#', (err) => {
                if (err) {
                    console.error('Subscription error:', err);
                } else {
                    console.log('Subscribed to trainflow/# topics');
                }
            });

            resolve(client);
        });

        client.on('error', (error) => {
            console.error('MQTT Connection error:', error);
            isConnected = false;
        });

        client.on('close', () => {
            console.log('MQTT Connection closed');
            isConnected = false;
        });

        client.on('reconnect', () => {
            console.log('Attempting to reconnect to MQTT...');
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

                // Buffer sensor data for FFT computation
                if (topic === 'trainflow/sensor/A' && data) {
                    lastEsp32DataTime = Date.now(); // Update heartbeat
                    sensorBuffer.sensorA.push(data);
                    if (sensorBuffer.sensorA.length > maxBufferSize) {
                        sensorBuffer.sensorA.shift();
                    }
                } else if (topic === 'trainflow/sensor/B' && data) {
                    lastEsp32DataTime = Date.now(); // Update heartbeat
                    sensorBuffer.sensorB.push(data);
                    if (sensorBuffer.sensorB.length > maxBufferSize) {
                        sensorBuffer.sensorB.shift();
                    }
                }

                // Call the message callback if set
                if (messageCallback) {
                    messageCallback(topic, data);
                }
            } catch (e) {
                // If not JSON, store as string
                trainData[topic] = {
                    data: messageStr,
                    timestamp: new Date().toISOString()
                };
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
