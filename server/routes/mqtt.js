const express = require('express');
const router = express.Router();
const { publishMessage, subscribeToTopic, getTrainData, getConnectionStatus, computeAllFFT, toIST, getDirectionDetector, resetDirectionDetector } = require('../services/mqttService');
const MqttRecord = require('../models/MqttRecord');
const TrainEvent = require('../models/TrainEvent');

// @desc    Get MQTT connection status
// @route   GET /api/mqtt/status
// @access  Public
router.get('/status', (req, res) => {
    res.json({
        connected: getConnectionStatus(),
        message: getConnectionStatus() ? 'Connected to MQTT broker' : 'Not connected'
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

// @desc    Get recorded MQTT messages from database
// @route   GET /api/mqtt/records
// @access  Public
// @query   topic, station, sensorId, from (ISO date), to (ISO date), limit (default 100, max 1000)
router.get('/records', async (req, res) => {
    try {
        const { topic, station, sensorId, from, to, limit } = req.query;
        const filter = {};

        if (topic) filter.topic = topic;
        if (station) filter.station = station;
        if (sensorId) filter.sensorId = sensorId;
        if (from || to) {
            filter.receivedAt = {};
            if (from) filter.receivedAt.$gte = new Date(from);
            if (to) filter.receivedAt.$lte = new Date(to);
        }

        const maxLimit = Math.min(parseInt(limit) || 100, 1000);

        const records = await MqttRecord.find(filter)
            .sort({ receivedAt: -1 })
            .limit(maxLimit)
            .lean();

        res.json({
            success: true,
            count: records.length,
            data: records
        });
    } catch (err) {
        console.error('Error fetching MQTT records:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch records' });
    }
});

// ── Train Event Trigger ─────────────────────────────────────────

// @desc    Start a train event (train is coming)
// @route   POST /api/mqtt/train-event/start
// @access  Public
router.post('/train-event/start', async (req, res) => {
    try {
        const { station = 'Makumbura', notes = '' } = req.body;

        // Close any active event for this station first
        const now = new Date();
        await TrainEvent.updateMany(
            { station, active: true },
            { active: false, endTime: now, endTimeIST: toIST(now), $set: { notes: notes || 'auto-closed by new event' } }
        );

        const startTime = new Date();
        const event = await TrainEvent.create({
            station,
            type: 'approaching',
            startTime,
            startTimeIST: toIST(startTime),
            active: true,
            notes
        });

        // Reset direction detector for new event
        resetDirectionDetector();
        console.log(`[TrainEvent] Started: ${station} at ${toIST(startTime)} | Direction detector reset`);
        res.json({ success: true, event });
    } catch (err) {
        console.error('Train event start error:', err);
        res.status(500).json({ success: false, message: 'Failed to start train event' });
    }
});

// @desc    Stop the active train event (train has passed)
// @route   POST /api/mqtt/train-event/stop
// @access  Public
router.post('/train-event/stop', async (req, res) => {
    try {
        const { station = 'Makumbura' } = req.body;

        const event = await TrainEvent.findOne({ station, active: true }).sort({ startTime: -1 });
        if (!event) {
            return res.status(404).json({ success: false, message: 'No active train event found' });
        }

        event.endTime = new Date();
        event.endTimeIST = toIST(event.endTime);
        event.duration = event.endTime - event.startTime;
        event.active = false;
        event.type = 'stopped';
        await event.save();

        // Finalize direction detection and save to event
        const detector = getDirectionDetector();
        const dirResult = await detector.finalizeDirection(event._id);

        console.log(`[TrainEvent] Stopped: ${station} | Duration: ${(event.duration / 1000).toFixed(1)}s | Direction: ${dirResult?.direction || 'unknown'} (${dirResult?.confidence || 0}%) | ${toIST(event.endTime)}`);
        
        // Return updated event with direction
        const updatedEvent = await TrainEvent.findById(event._id).lean();
        res.json({ success: true, event: updatedEvent });
    } catch (err) {
        console.error('Train event stop error:', err);
        res.status(500).json({ success: false, message: 'Failed to stop train event' });
    }
});

// @desc    Get the currently active train event (if any)
// @route   GET /api/mqtt/train-event/active
// @access  Public
router.get('/train-event/active', async (req, res) => {
    try {
        const { station = 'Makumbura' } = req.query;
        const event = await TrainEvent.findOne({ station, active: true }).sort({ startTime: -1 }).lean();
        res.json({ success: true, active: !!event, event: event || null });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to check active event' });
    }
});

// @desc    Get all train events (history)
// @route   GET /api/mqtt/train-events
// @access  Public
// @query   station, from, to, limit
router.get('/train-events', async (req, res) => {
    try {
        const { station, from, to, limit } = req.query;
        const filter = {};

        if (station) filter.station = station;
        if (from || to) {
            filter.startTime = {};
            if (from) filter.startTime.$gte = new Date(from);
            if (to) filter.startTime.$lte = new Date(to);
        }

        const maxLimit = Math.min(parseInt(limit) || 50, 500);

        const events = await TrainEvent.find(filter)
            .sort({ startTime: -1 })
            .limit(maxLimit)
            .lean();

        res.json({ success: true, count: events.length, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch train events' });
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

// ── Direction Detection Endpoints ───────────────────────────────

// @desc    Get current direction detector status (for live monitoring)
// @route   GET /api/mqtt/direction/status
// @access  Public
router.get('/direction/status', (req, res) => {
    const detector = getDirectionDetector();
    res.json({ success: true, data: detector.getStatus() });
});

// @desc    Run post-event direction analysis on a historical event
// @route   POST /api/mqtt/direction/analyze/:eventId
// @access  Public
router.post('/direction/analyze/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const event = await TrainEvent.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const bufferBefore = 30, bufferAfter = 30;
        const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
        const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

        // Fetch sensor records for this event window
        const records = await MqttRecord.find({
            station: event.station?.toLowerCase() || 'makumbura',
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: windowStart, $lte: windowEnd }
        }).sort({ receivedAt: 1 }).lean();

        if (records.length === 0) {
            return res.json({ success: false, message: 'No sensor data found for this event' });
        }

        // Create a fresh detector and replay the data
        const DirectionDetector = require('../services/directionDetector');
        const detector = new DirectionDetector(event.station || 'Makumbura');

        for (const record of records) {
            if (!record.payload) continue;
            detector.onSensorData(record.sensorId, {
                z_g: record.payload.z_g ?? 0,
                y_g: record.payload.y_g ?? 0,
                t_us: record.payload.t_us ?? 0
            });
        }

        // Finalize and save to event
        const result = await detector.finalizeDirection(event._id);

        res.json({
            success: true,
            data: {
                eventId: event._id,
                startTime: event.startTimeIST,
                endTime: event.endTimeIST,
                recordsAnalyzed: records.length,
                ...result
            }
        });
    } catch (err) {
        console.error('Direction analysis error:', err);
        res.status(500).json({ success: false, message: 'Failed to analyze direction' });
    }
});

// @desc    Analyze direction for all events that don't have one
// @route   POST /api/mqtt/direction/analyze-all
// @access  Public
router.post('/direction/analyze-all', async (req, res) => {
    try {
        const events = await TrainEvent.find({
            direction: { $in: ['unknown', null, undefined] },
            endTime: { $exists: true, $ne: null }
        }).sort({ startTime: -1 });

        const results = [];
        const DirectionDetector = require('../services/directionDetector');

        for (const event of events) {
            const bufferBefore = 30, bufferAfter = 30;
            const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
            const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

            const records = await MqttRecord.find({
                station: event.station?.toLowerCase() || 'makumbura',
                sensorId: { $in: ['sensor1', 'sensor2'] },
                receivedAt: { $gte: windowStart, $lte: windowEnd }
            }).sort({ receivedAt: 1 }).lean();

            if (records.length < 10) {
                results.push({ eventId: event._id, status: 'skipped', reason: 'insufficient data' });
                continue;
            }

            const detector = new DirectionDetector(event.station || 'Makumbura');
            for (const record of records) {
                if (!record.payload) continue;
                detector.onSensorData(record.sensorId, {
                    z_g: record.payload.z_g ?? 0,
                    y_g: record.payload.y_g ?? 0,
                    t_us: record.payload.t_us ?? 0
                });
            }

            const result = await detector.finalizeDirection(event._id);
            results.push({
                eventId: event._id,
                startTime: event.startTimeIST,
                direction: result.direction,
                confidence: result.confidence,
                records: records.length
            });
        }

        res.json({ success: true, analyzed: results.length, results });
    } catch (err) {
        console.error('Batch direction analysis error:', err);
        res.status(500).json({ success: false, message: 'Failed to analyze directions' });
    }
});

module.exports = router;
