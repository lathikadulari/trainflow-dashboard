const express = require('express');
const router = express.Router();
const NoiseProfile = require('../models/NoiseProfile');
const MqttRecord = require('../models/MqttRecord');
const { computeFFT, toIST } = require('../services/mqttService');

// Helper to calculate statistical parameters
function calculateStats(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return { min: 0, max: 0, mean: 0, stdDev: 0, vpp: 0, rms: 0 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const vpp = max - min;
    const rms = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v, 2), 0) / values.length);
    
    return { min, max, mean, stdDev, vpp, rms };
}

// @desc    Analyze records in a time window and save as noise profile
// @route   POST /api/noise/calibrate
// @access  Public
router.post('/calibrate', async (req, res) => {
    try {
        const { station = 'Makumbura', sensorId, startTime, endTime, notes = '' } = req.body;

        if (!sensorId || !startTime || !endTime) {
            return res.status(400).json({ success: false, message: 'sensorId, startTime, and endTime are required' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);
        const durationSec = (end - start) / 1000;

        if (durationSec <= 0) {
            return res.status(400).json({ success: false, message: 'End time must be after start time' });
        }

        // Query MqttRecords in time range
        const records = await MqttRecord.find({
            station: station.toLowerCase(),
            sensorId: sensorId,
            receivedAt: { $gte: start, $lte: end }
        }).sort({ receivedAt: 1 }).lean();

        if (records.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `No sensor records found for ${sensorId} in calibration window (${Math.round(durationSec)}s)` 
            });
        }

        // Extract voltage and acceleration values
        const yGValues = [];
        const zGValues = [];
        const yVValues = [];
        const zVValues = [];

        records.forEach(r => {
            if (r.payload) {
                // If it is raw MQTT payload (y_g, z_g)
                const yg = r.payload.y_g ?? r.payload.x_g ?? 0;
                const zg = r.payload.z_g ?? 0;
                const yv = r.payload.y_v ?? r.payload.x_v ?? 1.65;
                const zv = r.payload.z_v ?? 1.65;

                yGValues.push(yg);
                zGValues.push(zg);
                yVValues.push(yv);
                zVValues.push(zv);
            }
        });

        // Calculate stats
        const accelerationNoise = {
            y: calculateStats(yGValues),
            z: calculateStats(zGValues)
        };

        const voltageFluctuations = {
            y: calculateStats(yVValues),
            z: calculateStats(zVValues)
        };

        // Estimate actual sample rate (Hz)
        const samplesCount = records.length;
        const estimatedSampleRate = Math.max(1, samplesCount / durationSec);

        // Run FFT
        const fftY = computeFFT(yGValues, estimatedSampleRate);
        const fftZ = computeFFT(zGValues, estimatedSampleRate);

        // Find dominant frequencies
        let dominantFreqY = 0;
        let maxMagY = -1;
        fftY.forEach(pt => {
            if (pt.magnitude > maxMagY) {
                maxMagY = pt.magnitude;
                dominantFreqY = pt.frequency;
            }
        });

        let dominantFreqZ = 0;
        let maxMagZ = -1;
        fftZ.forEach(pt => {
            if (pt.magnitude > maxMagZ) {
                maxMagZ = pt.magnitude;
                dominantFreqZ = pt.frequency;
            }
        });

        // Limit spectrum saved in DB to keep size clean (e.g. top 128 points or all if smaller)
        const fftSpectrum = {
            y: fftY.slice(0, 150),
            z: fftZ.slice(0, 150)
        };

        const profile = await NoiseProfile.create({
            station,
            sensorId,
            startTime: start,
            endTime: end,
            durationSeconds: parseFloat(durationSec.toFixed(2)),
            samplesCount,
            voltageFluctuations,
            accelerationNoise,
            dominantFrequencies: {
                y: dominantFreqY,
                z: dominantFreqZ
            },
            fftSpectrum,
            notes,
            localTime: toIST(new Date())
        });

        res.json({
            success: true,
            message: 'Calibration completed successfully',
            data: profile
        });

    } catch (err) {
        console.error('Calibration calculation error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during calibration' });
    }
});

// @desc    Get saved noise profiles
// @route   GET /api/noise/profiles
// @access  Public
router.get('/profiles', async (req, res) => {
    try {
        const { station, sensorId } = req.query;
        const filter = {};
        if (station) filter.station = station;
        if (sensorId) filter.sensorId = sensorId;

        const profiles = await NoiseProfile.find(filter)
            .sort({ recordedAt: -1 })
            .lean();

        res.json({
            success: true,
            count: profiles.length,
            data: profiles
        });
    } catch (err) {
        console.error('Fetch noise profiles error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch noise profiles' });
    }
});

// @desc    Delete a noise profile
// @route   DELETE /api/noise/profiles/:id
// @access  Public
router.delete('/profiles/:id', async (req, res) => {
    try {
        const profile = await NoiseProfile.findByIdAndDelete(req.params.id);
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Noise profile not found' });
        }
        res.json({ success: true, message: 'Noise profile deleted successfully' });
    } catch (err) {
        console.error('Delete noise profile error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete noise profile' });
    }
});

// @desc    Export profile as formatted JSON file download
// @route   GET /api/noise/profiles/:id/download
// @access  Public
router.get('/profiles/:id/download', async (req, res) => {
    try {
        const profile = await NoiseProfile.findById(req.params.id).lean();
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Noise profile not found' });
        }

        const fileName = `noise_profile_${profile.sensorId}_${profile.station}_${new Date(profile.recordedAt).getTime()}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(JSON.stringify(profile, null, 4));
    } catch (err) {
        console.error('Download noise profile error:', err);
        res.status(500).json({ success: false, message: 'Failed to download noise profile' });
    }
});

module.exports = router;
