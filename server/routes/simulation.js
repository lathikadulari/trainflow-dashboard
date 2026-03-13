const express = require('express');
const router = express.Router();
const simulator = require('../services/sensorSimulator');

// Store SSE clients
let sseClients = [];

// @desc    Get simulation status
// @route   GET /api/simulation/status
// @access  Public
router.get('/status', (req, res) => {
    res.json(simulator.getStatus());
});

// @desc    Start simulation
// @route   POST /api/simulation/start
// @access  Public
router.post('/start', (req, res) => {
    simulator.start();
    res.json({ success: true, message: 'Simulation started' });
});

// @desc    Stop simulation
// @route   POST /api/simulation/stop
// @access  Public
router.post('/stop', (req, res) => {
    simulator.stop();
    res.json({ success: true, message: 'Simulation stopped' });
});

// @desc    Trigger a train manually
// @route   POST /api/simulation/trigger-train
// @access  Public
router.post('/trigger-train', (req, res) => {
    const { direction, speed } = req.body;
    const success = simulator.triggerTrain(direction, speed);

    if (success) {
        res.json({ success: true, message: 'Train triggered' });
    } else {
        res.status(400).json({ success: false, message: 'Train already in progress' });
    }
});

// @desc    Get data buffer
// @route   GET /api/simulation/buffer
// @access  Public
router.get('/buffer', (req, res) => {
    res.json(simulator.getBuffer());
});

// @desc    Get FFT data (DSP PIC simulation)
// @route   GET /api/simulation/fft
// @access  Public
router.get('/fft', (req, res) => {
    const fftData = simulator.computeAllFFT();
    if (fftData) {
        res.json({ success: true, data: fftData });
    } else {
        res.json({ success: false, message: 'Not enough data for FFT computation', data: null });
    }
});

// @desc    SSE stream for real-time sensor data
// @route   GET /api/simulation/stream
// @access  Public
router.get('/stream', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    // Add client to list
    const clientId = Date.now();
    const client = { id: clientId, res };
    sseClients.push(client);

    console.log(`SSE client connected: ${clientId}`);

    // Send initial status
    res.write(`data: ${JSON.stringify({ type: 'status', data: simulator.getStatus() })}\n\n`);

    // Only start if not already running when someone connects
    if (!simulator.isRunning) {
        simulator.start();
    }

    // Remove client on disconnect
    req.on('close', () => {
        sseClients = sseClients.filter(c => c.id !== clientId);
        console.log(`SSE client disconnected: ${clientId}`);
        // If no clients left, stop simulator to save resources
        if (sseClients.length === 0) {
            simulator.stop();
        }
    });
});

// Setup simulator event listeners
simulator.on('data', (data) => {
    const message = JSON.stringify({ type: 'data', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

simulator.on('trainApproaching', (data) => {
    const message = JSON.stringify({ type: 'trainApproaching', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

simulator.on('trainPassing', (data) => {
    const message = JSON.stringify({ type: 'trainPassing', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

simulator.on('trainDeparting', (data) => {
    const message = JSON.stringify({ type: 'trainDeparting', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

simulator.on('trainPassed', (data) => {
    const message = JSON.stringify({ type: 'trainPassed', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

simulator.on('sensorTriggered', (data) => {
    const message = JSON.stringify({ type: 'sensorTriggered', data });
    sseClients.forEach(client => {
        client.res.write(`data: ${message}\n\n`);
    });
});

module.exports = router;
