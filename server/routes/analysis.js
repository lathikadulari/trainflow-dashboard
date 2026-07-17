const express = require('express');
const router = express.Router();
const TrainEvent = require('../models/TrainEvent');
const MqttRecord = require('../models/MqttRecord');

// ── Helper: IST formatter ───────────────────────────────────
function toIST(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }) + '.' + String(d.getMilliseconds()).padStart(3, '0') + ' IST';
}

// @desc    Query train events with flexible filters
// @route   GET /api/analysis/events
// @access  Public
// @query   from, to, station, type, minDuration, maxDuration, active, limit, skip
router.get('/events', async (req, res) => {
    try {
        const { from, to, station, type, minDuration, maxDuration, active, limit, skip } = req.query;
        const filter = {};

        // Date range filter on startTime
        if (from || to) {
            filter.startTime = {};
            if (from) filter.startTime.$gte = new Date(from);
            if (to) filter.startTime.$lte = new Date(to);
        }

        if (station) filter.station = station;
        if (type) filter.type = type;

        // Active filter
        if (active === 'true') filter.active = true;
        if (active === 'false') filter.active = false;

        // Duration range filter (in milliseconds)
        if (minDuration || maxDuration) {
            filter.duration = {};
            if (minDuration) filter.duration.$gte = parseInt(minDuration);
            if (maxDuration) filter.duration.$lte = parseInt(maxDuration);
        }

        const maxLimit = Math.min(parseInt(limit) || 50, 500);
        const skipCount = parseInt(skip) || 0;

        const [events, totalCount] = await Promise.all([
            TrainEvent.find(filter)
                .sort({ startTime: -1 })
                .skip(skipCount)
                .limit(maxLimit)
                .lean(),
            TrainEvent.countDocuments(filter)
        ]);

        res.json({
            success: true,
            count: events.length,
            total: totalCount,
            data: events
        });
    } catch (err) {
        console.error('Analysis events error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
});

// @desc    Get sensor data for a specific train event with time buffer
// @route   GET /api/analysis/event-data/:eventId
// @access  Public
// @query   bufferBefore (seconds, default 30), bufferAfter (seconds, default 30), sensorId (sensor1|sensor2|status)
router.get('/event-data/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        const bufferBefore = parseInt(req.query.bufferBefore) || 30;
        const bufferAfter = parseInt(req.query.bufferAfter) || 30;
        const sensorId = req.query.sensorId; // optional: 'sensor1', 'sensor2'

        // Fetch the event
        const event = await TrainEvent.findById(eventId).lean();
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Compute the expanded time window
        const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
        const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

        // Build filter for sensor records
        const recordFilter = {
            station: event.station.toLowerCase(),
            receivedAt: { $gte: windowStart, $lte: windowEnd }
        };

        // Filter to only sensor data (exclude status messages)
        if (sensorId) {
            recordFilter.sensorId = sensorId;
        } else {
            recordFilter.sensorId = { $in: ['sensor1', 'sensor2'] };
        }

        // Fetch sensor records — up to 50000 for high-rate data
        const records = await MqttRecord.find(recordFilter)
            .sort({ receivedAt: 1 })
            .limit(50000)
            .lean();

        // Separate by sensor
        const sensor1Records = records.filter(r => r.sensorId === 'sensor1');
        const sensor2Records = records.filter(r => r.sensorId === 'sensor2');

        // Compute basic statistics per sensor
        const computeStats = (sensorRecords) => {
            if (sensorRecords.length === 0) return null;

            let yMin = Infinity, yMax = -Infinity, ySum = 0;
            let zMin = Infinity, zMax = -Infinity, zSum = 0;

            sensorRecords.forEach(r => {
                const yg = r.payload?.y_g ?? 0;
                const zg = r.payload?.z_g ?? 0;
                if (yg < yMin) yMin = yg;
                if (yg > yMax) yMax = yg;
                ySum += yg;
                if (zg < zMin) zMin = zg;
                if (zg > zMax) zMax = zg;
                zSum += zg;
            });

            const count = sensorRecords.length;
            return {
                count,
                y: { min: yMin, max: yMax, avg: ySum / count, range: yMax - yMin },
                z: { min: zMin, max: zMax, avg: zSum / count, range: zMax - zMin }
            };
        };

        // ── High-resolution timestamp reconstruction (COMMON ANCHOR) ──
        // Problem: receivedAt is the server arrival time. The ESP32 reads and
        // publishes sensor1 before sensor2 in each cycle, so sensor1's receivedAt
        // is SYSTEMATICALLY earlier. If each sensor is anchored independently to
        // its own receivedAt, the Right sensor (sensor1) always appears to trigger
        // before the Left sensor (sensor2), even when the Left sensor truly
        // detected vibration first.
        //
        // Solution: Both sensors share the SAME ESP32 micros() clock (t_us).
        // We pick ONE common anchor point (the earliest record across both
        // sensors) and reconstruct ALL timestamps relative to that single
        // (receivedAt, t_us) pair. This preserves the real microsecond-level
        // timing between left and right sensors.
        //
        // t_us wraps around at ~71 minutes (32-bit micros()), so we handle wraps.

        // ── Find common anchor across both sensors ──────────────
        const allSensorRecords = [...sensor1Records, ...sensor2Records];
        allSensorRecords.sort((a, b) =>
            new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
        );

        // The anchor is the very first record (by receivedAt) across both sensors
        const commonAnchorTime = allSensorRecords.length > 0
            ? new Date(allSensorRecords[0].receivedAt).getTime()
            : 0;
        const commonAnchorTus = allSensorRecords.length > 0
            ? (allSensorRecords[0].payload?.t_us ?? 0)
            : 0;

        // Check if t_us data is available across either sensor
        const hasValidTus = allSensorRecords.some(r => {
            const tus = r.payload?.t_us;
            return tus != null && tus > 0;
        });

        const reconstructTimestamps = (sensorRecords) => {
            if (sensorRecords.length === 0) return [];

            if (!hasValidTus || commonAnchorTus === 0) {
                // Fallback: use receivedAt as-is (no t_us data available)
                return sensorRecords.map(r => ({
                    t: r.receivedAt,
                    y_g: r.payload?.y_g ?? 0,
                    z_g: r.payload?.z_g ?? 0,
                    y_v: r.payload?.y_v ?? 0,
                    z_v: r.payload?.z_v ?? 0,
                    t_us: r.payload?.t_us ?? 0
                }));
            }

            return sensorRecords.map((r) => {
                const tus = r.payload?.t_us ?? 0;

                if (tus === 0) {
                    // No t_us for this record, fall back to receivedAt
                    return {
                        t: r.receivedAt,
                        y_g: r.payload?.y_g ?? 0,
                        z_g: r.payload?.z_g ?? 0,
                        y_v: r.payload?.y_v ?? 0,
                        z_v: r.payload?.z_v ?? 0,
                        t_us: tus
                    };
                }

                // Compute delta from the COMMON anchor in microseconds
                // Handle 32-bit micros() wrap-around (~71.58 min = 4294967296 us)
                let deltaUs = tus - commonAnchorTus;
                if (deltaUs < -2147483648) {
                    // Wrapped forward
                    deltaUs += 4294967296;
                } else if (deltaUs > 2147483648) {
                    // Wrapped backward (shouldn't happen in sorted data, but safety)
                    deltaUs -= 4294967296;
                }

                // Convert microsecond delta to milliseconds and add to common anchor
                const reconstructedMs = commonAnchorTime + (deltaUs / 1000);

                return {
                    t: new Date(reconstructedMs).toISOString(),
                    y_g: r.payload?.y_g ?? 0,
                    z_g: r.payload?.z_g ?? 0,
                    y_v: r.payload?.y_v ?? 0,
                    z_v: r.payload?.z_v ?? 0,
                    t_us: tus
                };
            });
        };

        const sensor1Data = reconstructTimestamps(sensor1Records);
        const sensor2Data = reconstructTimestamps(sensor2Records);

        res.json({
            success: true,
            event,
            window: {
                start: windowStart,
                startIST: toIST(windowStart),
                end: windowEnd,
                endIST: toIST(windowEnd),
                bufferBefore,
                bufferAfter
            },
            sensor1: {
                count: sensor1Records.length,
                stats: computeStats(sensor1Records),
                data: sensor1Data
            },
            sensor2: {
                count: sensor2Records.length,
                stats: computeStats(sensor2Records),
                data: sensor2Data
            },
            totalRecords: records.length
        });
    } catch (err) {
        console.error('Analysis event-data error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch event data' });
    }
});

// @desc    Get summary statistics for a date range
// @route   GET /api/analysis/summary
// @access  Public
// @query   from, to, station
router.get('/summary', async (req, res) => {
    try {
        const { from, to, station } = req.query;
        const filter = {};

        if (from || to) {
            filter.startTime = {};
            if (from) filter.startTime.$gte = new Date(from);
            if (to) filter.startTime.$lte = new Date(to);
        }
        if (station) filter.station = station;

        const events = await TrainEvent.find(filter).lean();

        const totalEvents = events.length;
        const completedEvents = events.filter(e => !e.active && e.duration);
        const avgDuration = completedEvents.length > 0
            ? completedEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / completedEvents.length
            : 0;
        const maxDuration = completedEvents.length > 0
            ? Math.max(...completedEvents.map(e => e.duration || 0))
            : 0;
        const minDuration = completedEvents.length > 0
            ? Math.min(...completedEvents.map(e => e.duration || 0))
            : 0;

        // Count sensor records in the same range
        const recordFilter = {};
        if (from || to) {
            recordFilter.receivedAt = {};
            if (from) recordFilter.receivedAt.$gte = new Date(from);
            if (to) recordFilter.receivedAt.$lte = new Date(to);
        }
        if (station) recordFilter.station = station.toLowerCase();
        recordFilter.sensorId = { $in: ['sensor1', 'sensor2'] };

        const sensorRecordCount = await MqttRecord.countDocuments(recordFilter);

        res.json({
            success: true,
            summary: {
                totalEvents,
                completedEvents: completedEvents.length,
                activeEvents: events.filter(e => e.active).length,
                avgDuration: Math.round(avgDuration),
                maxDuration,
                minDuration,
                sensorRecordCount
            }
        });
    } catch (err) {
        console.error('Analysis summary error:', err);
        res.status(500).json({ success: false, message: 'Failed to compute summary' });
    }
});

module.exports = router;
