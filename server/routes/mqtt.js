const express = require('express');
const router = express.Router();
const { publishMessage, subscribeToTopic, getTrainData, getConnectionStatus, computeAllFFT } = require('../services/mqttService');

// @desc    Get MQTT connection status
// @route   GET /api/mqtt/status
// @access  Public
router.get('/status', (req, res) => {
    res.json({
        connected: getConnectionStatus(),
        message: getConnectionStatus() ? 'Connected to HiveMQ Cloud' : 'Not connected'
    });
});

// @desc    Get all train data received via MQTT
// @route   GET /api/mqtt/trains
// @access  Public
router.get('/trains', (req, res) => {
    res.json(getTrainData());
});

// @desc    Get FFT computed from ESP32 sensor data
// @route   GET /api/mqtt/fft
// @access  Public
router.get('/fft', (req, res) => {
    const fftData = computeAllFFT();
    if (fftData) {
        res.json({ success: true, data: fftData });
    } else {
        res.json({ success: false, message: 'Not enough data for FFT computation' });
    }
});

// @desc    Publish a message to a topic
// @route   POST /api/mqtt/publish
// @access  Public
router.post('/publish', (req, res) => {
    const { topic, message } = req.body;

    if (!topic || !message) {
        return res.status(400).json({ message: 'Topic and message are required' });
    }

    const success = publishMessage(topic, message);

    if (success) {
        res.json({ success: true, message: `Published to ${topic}` });
    } else {
        res.status(500).json({ success: false, message: 'Failed to publish - MQTT not connected' });
    }
});

// @desc    Subscribe to a topic
// @route   POST /api/mqtt/subscribe
// @access  Public
router.post('/subscribe', (req, res) => {
    const { topic } = req.body;

    if (!topic) {
        return res.status(400).json({ message: 'Topic is required' });
    }

    const success = subscribeToTopic(topic);

    if (success) {
        res.json({ success: true, message: `Subscribed to ${topic}` });
    } else {
        res.status(500).json({ success: false, message: 'Failed to subscribe - MQTT not connected' });
    }
});

module.exports = router;
