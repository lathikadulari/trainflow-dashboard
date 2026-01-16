const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const mqttService = require('./services/mqttService');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Connect to HiveMQ Cloud MQTT
mqttService.connectMQTT().then((client) => {
    if (client) {
        console.log('MQTT service started successfully');
    }
}).catch(err => {
    console.log('MQTT connection deferred:', err.message);
});

const app = express();

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for testing
    credentials: true
}));
app.use(express.json());

// Auth routes
console.log('Loading auth routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('Auth routes loaded');

// Simulation routes (works without database)
console.log('Loading simulation routes...');
app.use('/api/simulation', require('./routes/simulation'));
console.log('Simulation routes loaded');

// MQTT routes for ESP32 data
console.log('Loading MQTT routes...');
app.use('/api/mqtt', require('./routes/mqtt'));
console.log('MQTT routes loaded');

// SSE endpoint for real-time ESP32 sensor data
let mqttSseClients = [];

// Set up MQTT message callback to broadcast to SSE clients
mqttService.setMessageCallback((topic, data) => {
    if (topic.startsWith('trainflow/sensor/') || topic === 'trainflow/trainState') {
        const message = JSON.stringify({ topic, data, timestamp: Date.now() });
        mqttSseClients.forEach(client => {
            client.res.write(`data: ${message}\n\n`);
        });
    }
});

// Periodically send ESP32 status to all SSE clients
setInterval(() => {
    const esp32Status = mqttService.getEsp32Status();
    const statusMessage = JSON.stringify({
        type: 'esp32_status',
        status: esp32Status,
        timestamp: Date.now()
    });
    mqttSseClients.forEach(client => {
        client.res.write(`data: ${statusMessage}\n\n`);
    });
}, 1000); // Check every second

app.get('/api/mqtt/stream', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const clientId = Date.now();
    const client = { id: clientId, res };
    mqttSseClients.push(client);

    console.log(`MQTT SSE client connected: ${clientId}`);

    // Send initial status
    const initialStatus = {
        type: 'status',
        connected: mqttService.getConnectionStatus(),
        esp32Status: mqttService.getEsp32Status()
    };
    res.write(`data: ${JSON.stringify(initialStatus)}\n\n`);

    // Remove client on disconnect
    req.on('close', () => {
        mqttSseClients = mqttSseClients.filter(c => c.id !== clientId);
        console.log(`MQTT SSE client disconnected: ${clientId}`);
    });
});

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'TrainFlow API is running',
        mqtt: mqttService.getConnectionStatus() ? 'connected' : 'disconnected'
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`====================================`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Simulation API: http://localhost:${PORT}/api/simulation`);
    console.log(`MQTT API: http://localhost:${PORT}/api/mqtt`);
    console.log(`ESP32 Stream: http://localhost:${PORT}/api/mqtt/stream`);
    console.log(`====================================`);
});
