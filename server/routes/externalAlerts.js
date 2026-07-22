const express = require('express');
const router = express.Router();
const TrainEvent = require('../models/TrainEvent');
const TrainApproach = require('../models/TrainApproach');

// In-memory collection of connected external SSE clients
let externalSseClients = [];

/**
 * Helper middleware to check API Key (Optional mode for public testing)
 */
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    // Allow public access or demo key 'trainflow-demo-key'
    if (process.env.REQUIRE_API_KEY === 'true' && apiKey !== process.env.EXTERNAL_API_KEY && apiKey !== 'trainflow-demo-key') {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Invalid or missing X-API-Key header'
        });
    }
    next();
};

/**
 * Broadcast an alert to all connected external SSE clients
 */
const broadcastAlert = (alertData) => {
    const payload = JSON.stringify({
        event: 'train_alert',
        data: alertData,
        timestamp: new Date().toISOString()
    });

    externalSseClients.forEach(client => {
        try {
            client.res.write(`data: ${payload}\n\n`);
        } catch (err) {
            console.error('Error writing to external SSE client:', err.message);
        }
    });
};

// Apply API Key validation middleware across endpoints
router.use(validateApiKey);

// @desc    Get API Health & Status
// @route   GET /api/v1/alerts/health
// @access  Public (with API key if required)
router.get('/health', (req, res) => {
    res.json({
        status: 'success',
        system: 'TrainFlow External Alerts API',
        version: 'v1.0.0',
        uptime: process.uptime(),
        activeSseSubscribers: externalSseClients.length,
        timestamp: new Date().toISOString()
    });
});

// @desc    Get latest train alerts and detection logs
// @route   GET /api/v1/alerts/latest
// @access  Public
router.get('/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const station = req.query.station;

        const query = {};
        if (station) {
            query.station = new RegExp(station, 'i');
        }

        const events = await TrainEvent.find(query)
            .sort({ startTime: -1 })
            .limit(limit);

        const approaches = await TrainApproach.find(query)
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json({
            status: 'success',
            count: events.length + approaches.length,
            data: {
                trainEvents: events,
                trainApproaches: approaches
            }
        });
    } catch (error) {
        console.error('Error fetching latest alerts:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve train alerts', error: error.message });
    }
});

// @desc    Get currently active/approaching trains
// @route   GET /api/v1/alerts/active-trains
// @access  Public
router.get('/active-trains', async (req, res) => {
    try {
        const activeEvents = await TrainEvent.find({ active: true }).sort({ startTime: -1 });
        const activeApproaches = await TrainApproach.find({ status: 'approaching' }).sort({ timestamp: -1 });

        res.json({
            status: 'success',
            activeCount: activeEvents.length + activeApproaches.length,
            data: {
                activeEvents,
                activeApproaches
            }
        });
    } catch (error) {
        console.error('Error fetching active trains:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve active trains', error: error.message });
    }
});

// @desc    Get train speed violations / standards compliance
// @route   GET /api/v1/alerts/speed-violations
// @access  Public
router.get('/speed-violations', async (req, res) => {
    try {
        const speedLimit = parseFloat(req.query.speedLimit) || 60; // Default 60 km/h limit
        const limit = parseInt(req.query.limit) || 50;

        const violations = await TrainApproach.find({
            speed: { $gt: speedLimit }
        })
        .sort({ timestamp: -1 })
        .limit(limit);

        res.json({
            status: 'success',
            speedLimitThresholdKmH: speedLimit,
            violationsCount: violations.length,
            data: violations.map(v => ({
                id: v._id,
                trainId: v.trainId,
                stationName: v.stationName,
                speedKmH: v.speed,
                exceededByKmH: Number((v.speed - speedLimit).toFixed(2)),
                distanceKm: v.distance,
                status: v.status,
                timestamp: v.timestamp
            }))
        });
    } catch (error) {
        console.error('Error fetching speed violations:', error);
        res.status(500).json({ status: 'error', message: 'Failed to retrieve speed violations', error: error.message });
    }
});

// @desc    Subscribe to real-time train alert SSE stream
// @route   GET /api/v1/alerts/stream
// @access  Public
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    externalSseClients.push(newClient);

    // Send initial connection handshake
    res.write(`data: ${JSON.stringify({ event: 'connected', clientId, message: 'Subscribed to TrainFlow Live Alerts Stream' })}\n\n`);

    // Keep connection alive with heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ event: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 15000);

    req.on('close', () => {
        clearInterval(heartbeat);
        externalSseClients = externalSseClients.filter(client => client.id !== clientId);
    });
});

module.exports = {
    router,
    broadcastAlert
};
