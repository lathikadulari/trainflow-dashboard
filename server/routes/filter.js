const express = require('express');
const router = express.Router();
const TrainEvent = require('../models/TrainEvent');
const MqttRecord = require('../models/MqttRecord');
const NoiseProfile = require('../models/NoiseProfile');
const FilteredRecord = require('../models/FilteredRecord');
const { computeFFT, toIST } = require('../services/mqttService');

// ── Helper: Reconstruct high-res timestamps using common anchor ──
function reconstructTimestamps(allRecords, sensorRecords) {
    if (sensorRecords.length === 0) return [];

    const sorted = [...allRecords].sort((a, b) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );

    const anchorTime = sorted.length > 0 ? new Date(sorted[0].receivedAt).getTime() : 0;
    const anchorTus = sorted.length > 0 ? (sorted[0].payload?.t_us ?? 0) : 0;
    const hasValidTus = allRecords.some(r => {
        const tus = r.payload?.t_us;
        return tus != null && tus > 0;
    });

    return sensorRecords.map(r => {
        const tus = r.payload?.t_us ?? 0;

        if (!hasValidTus || anchorTus === 0 || tus === 0) {
            return {
                t: r.receivedAt,
                y_g: r.payload?.y_g ?? r.payload?.x_g ?? 0,
                z_g: r.payload?.z_g ?? 0,
                y_v: r.payload?.y_v ?? r.payload?.x_v ?? 0,
                z_v: r.payload?.z_v ?? 0
            };
        }

        let deltaUs = tus - anchorTus;
        if (deltaUs < -2147483648) deltaUs += 4294967296;
        if (deltaUs > 2147483648) deltaUs -= 4294967296;

        return {
            t: new Date(anchorTime + (deltaUs / 1000)).toISOString(),
            y_g: r.payload?.y_g ?? r.payload?.x_g ?? 0,
            z_g: r.payload?.z_g ?? 0,
            y_v: r.payload?.y_v ?? r.payload?.x_v ?? 0,
            z_v: r.payload?.z_v ?? 0
        };
    });
}

// ── Filter Algorithms ──

// 1. Mean Subtraction — remove DC offset from noise baseline
function filterMeanSubtraction(data, noiseProfile, axis) {
    const noiseMean = noiseProfile.accelerationNoise[axis]?.mean ?? 0;
    return data.map(d => {
        const key = `${axis}_g`;
        return { ...d, [key]: d[key] - noiseMean };
    });
}

// 2. Threshold Gate — zero out samples within ±N·σ of noise floor
function filterThresholdGate(data, noiseProfile, axis, sigmaMultiplier = 3) {
    const noiseMean = noiseProfile.accelerationNoise[axis]?.mean ?? 0;
    const noiseStd = noiseProfile.accelerationNoise[axis]?.stdDev ?? 0;
    const threshold = noiseStd * sigmaMultiplier;

    return data.map(d => {
        const key = `${axis}_g`;
        const deviation = Math.abs(d[key] - noiseMean);
        return { ...d, [key]: deviation > threshold ? d[key] - noiseMean : 0 };
    });
}

// 3. Moving Average — smooth the signal with a sliding window
function filterMovingAverage(data, axis, windowSize = 5) {
    const key = `${axis}_g`;
    const half = Math.floor(windowSize / 2);

    return data.map((d, i) => {
        let sum = 0;
        let count = 0;
        for (let j = i - half; j <= i + half; j++) {
            if (j >= 0 && j < data.length) {
                sum += data[j][key];
                count++;
            }
        }
        return { ...d, [key]: sum / count };
    });
}

// 4. Spectral Subtraction — subtract noise FFT magnitude from signal FFT
function filterSpectralSubtraction(data, noiseProfile, axis, subtractionFactor = 1.0) {
    const key = `${axis}_g`;
    const signal = data.map(d => d[key]);
    const N = signal.length;

    if (N < 16) return data;

    // Estimate sample rate from timestamps
    const t0 = new Date(data[0].t).getTime();
    const tEnd = new Date(data[data.length - 1].t).getTime();
    const durationSec = Math.max(0.001, (tEnd - t0) / 1000);
    const sampleRate = N / durationSec;

    // Compute signal FFT
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    const mean = signal.reduce((s, v) => s + v, 0) / N;
    for (let i = 0; i < N; i++) {
        real[i] = signal[i] - mean;
    }

    // Bit-reversal permutation
    let j = 0;
    for (let i = 0; i < paddedLength - 1; i++) {
        if (i < j) {
            let temp = real[i]; real[i] = real[j]; real[j] = temp;
            temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
        }
        let m = paddedLength >> 1;
        while (m <= j) { j -= m; m >>= 1; }
        j += m;
    }

    // FFT
    for (let i = 1; i < paddedLength; i <<= 1) {
        const step = i << 1;
        const theta = -Math.PI / i;
        const wTemp = Math.sin(0.5 * theta);
        const wR = -2.0 * wTemp * wTemp;
        const wI = Math.sin(theta);
        for (let m2 = 0; m2 < paddedLength; m2 += step) {
            let wr = 1.0, wi = 0.0;
            for (let k = 0; k < i; k++) {
                const idx1 = m2 + k, idx2 = m2 + k + i;
                const tr = wr * real[idx2] - wi * imag[idx2];
                const ti = wr * imag[idx2] + wi * real[idx2];
                real[idx2] = real[idx1] - tr;
                imag[idx2] = imag[idx1] - ti;
                real[idx1] += tr;
                imag[idx1] += ti;
                const wtr = wr * wR - wi * wI + wr;
                const wti = wi * wR + wr * wI + wi;
                wr = wtr; wi = wti;
            }
        }
    }

    // Build noise magnitude map from profile FFT
    const noiseSpectrum = noiseProfile.fftSpectrum?.[axis] ?? [];
    const noiseMap = {};
    noiseSpectrum.forEach(pt => {
        noiseMap[pt.frequency.toFixed(2)] = pt.magnitude;
    });

    // Subtract noise magnitude (keep phase)
    for (let k = 1; k < paddedLength / 2; k++) {
        const freq = (k * sampleRate) / paddedLength;
        const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        const phase = Math.atan2(imag[k], real[k]);

        // Find closest noise frequency
        let closestNoiseMag = 0;
        const freqKey = freq.toFixed(2);
        if (noiseMap[freqKey] !== undefined) {
            closestNoiseMag = noiseMap[freqKey];
        } else {
            // Find nearest
            let minDist = Infinity;
            for (const pt of noiseSpectrum) {
                const dist = Math.abs(pt.frequency - freq);
                if (dist < minDist) {
                    minDist = dist;
                    closestNoiseMag = pt.magnitude;
                }
            }
        }

        const cleanMag = Math.max(0, mag - closestNoiseMag * subtractionFactor * paddedLength);

        real[k] = cleanMag * Math.cos(phase);
        imag[k] = cleanMag * Math.sin(phase);

        // Mirror
        const mirror = paddedLength - k;
        real[mirror] = cleanMag * Math.cos(-phase);
        imag[mirror] = cleanMag * Math.sin(-phase);
    }

    // Inverse FFT (conjugate method)
    for (let i = 0; i < paddedLength; i++) imag[i] = -imag[i];

    // Bit-reversal
    j = 0;
    for (let i = 0; i < paddedLength - 1; i++) {
        if (i < j) {
            let temp = real[i]; real[i] = real[j]; real[j] = temp;
            temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
        }
        let m = paddedLength >> 1;
        while (m <= j) { j -= m; m >>= 1; }
        j += m;
    }

    for (let i = 1; i < paddedLength; i <<= 1) {
        const step = i << 1;
        const theta = -Math.PI / i;
        const wTemp = Math.sin(0.5 * theta);
        const wR = -2.0 * wTemp * wTemp;
        const wI = Math.sin(theta);
        for (let m2 = 0; m2 < paddedLength; m2 += step) {
            let wr = 1.0, wi = 0.0;
            for (let k = 0; k < i; k++) {
                const idx1 = m2 + k, idx2 = m2 + k + i;
                const tr = wr * real[idx2] - wi * imag[idx2];
                const ti = wr * imag[idx2] + wi * real[idx2];
                real[idx2] = real[idx1] - tr;
                imag[idx2] = imag[idx1] - ti;
                real[idx1] += tr;
                imag[idx1] += ti;
                const wtr = wr * wR - wi * wI + wr;
                const wti = wi * wR + wr * wI + wi;
                wr = wtr; wi = wti;
            }
        }
    }

    // Reconstruct
    const filtered = data.map((d, i) => {
        if (i >= paddedLength) return d;
        return { ...d, [key]: (real[i] / paddedLength) + mean };
    });

    return filtered;
}

// 5. Bandpass Filter — keep only frequencies in [lowCutoff, highCutoff] Hz
function filterBandpass(data, axis, lowCutoff = 0.5, highCutoff = 5.0) {
    const key = `${axis}_g`;
    const signal = data.map(d => d[key]);
    const N = signal.length;

    if (N < 16) return data;

    const t0 = new Date(data[0].t).getTime();
    const tEnd = new Date(data[data.length - 1].t).getTime();
    const durationSec = Math.max(0.001, (tEnd - t0) / 1000);
    const sampleRate = N / durationSec;

    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
    const real = new Float64Array(paddedLength);
    const imag = new Float64Array(paddedLength);

    const mean = signal.reduce((s, v) => s + v, 0) / N;
    for (let i = 0; i < N; i++) {
        real[i] = signal[i] - mean;
    }

    // FFT
    j = 0;
    for (let i = 0; i < paddedLength - 1; i++) {
        if (i < j) {
            let temp = real[i]; real[i] = real[j]; real[j] = temp;
        }
        let m = paddedLength >> 1;
        while (m <= j) { j -= m; m >>= 1; }
        j += m;
    }

    for (let i = 1; i < paddedLength; i <<= 1) {
        const step = i << 1;
        const theta = -Math.PI / i;
        const wTemp = Math.sin(0.5 * theta);
        const wR = -2.0 * wTemp * wTemp;
        const wI = Math.sin(theta);
        for (let m2 = 0; m2 < paddedLength; m2 += step) {
            let wr = 1.0, wi = 0.0;
            for (let k = 0; k < i; k++) {
                const idx1 = m2 + k, idx2 = m2 + k + i;
                const tr = wr * real[idx2] - wi * imag[idx2];
                const ti = wr * imag[idx2] + wi * real[idx2];
                real[idx2] = real[idx1] - tr;
                imag[idx2] = imag[idx1] - ti;
                real[idx1] += tr;
                imag[idx1] += ti;
                const wtr = wr * wR - wi * wI + wr;
                const wti = wi * wR + wr * wI + wi;
                wr = wtr; wi = wti;
            }
        }
    }

    // Zero out frequencies outside bandpass
    for (let k = 0; k < paddedLength; k++) {
        const freq = k <= paddedLength / 2
            ? (k * sampleRate) / paddedLength
            : ((paddedLength - k) * sampleRate) / paddedLength;

        if (freq < lowCutoff || freq > highCutoff) {
            real[k] = 0;
            imag[k] = 0;
        }
    }

    // Inverse FFT
    for (let i = 0; i < paddedLength; i++) imag[i] = -imag[i];

    j = 0;
    for (let i = 0; i < paddedLength - 1; i++) {
        if (i < j) {
            let temp = real[i]; real[i] = real[j]; real[j] = temp;
            temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
        }
        let m = paddedLength >> 1;
        while (m <= j) { j -= m; m >>= 1; }
        j += m;
    }

    for (let i = 1; i < paddedLength; i <<= 1) {
        const step = i << 1;
        const theta = -Math.PI / i;
        const wTemp = Math.sin(0.5 * theta);
        const wR = -2.0 * wTemp * wTemp;
        const wI = Math.sin(theta);
        for (let m2 = 0; m2 < paddedLength; m2 += step) {
            let wr = 1.0, wi = 0.0;
            for (let k = 0; k < i; k++) {
                const idx1 = m2 + k, idx2 = m2 + k + i;
                const tr = wr * real[idx2] - wi * imag[idx2];
                const ti = wr * imag[idx2] + wi * real[idx2];
                real[idx2] = real[idx1] - tr;
                imag[idx2] = imag[idx1] - ti;
                real[idx1] += tr;
                imag[idx1] += ti;
                const wtr = wr * wR - wi * wI + wr;
                const wti = wi * wR + wr * wI + wi;
                wr = wtr; wi = wti;
            }
        }
    }

    return data.map((d, i) => {
        if (i >= paddedLength) return d;
        return { ...d, [key]: (real[i] / paddedLength) + mean };
    });
}

// ── Metrics Computation ──
function computeMetrics(rawData, filteredData, axis) {
    const key = `${axis}_g`;
    const rawVals = rawData.map(d => d[key]);
    const filtVals = filteredData.map(d => d[key]);

    const rms = arr => Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / arr.length);
    const peak = arr => Math.max(...arr.map(Math.abs));
    const energy = arr => arr.reduce((s, v) => s + v * v, 0);
    const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;

    const rawRms = rms(rawVals);
    const filtRms = rms(filtVals);
    const rawPeak = peak(rawVals);
    const filtPeak = peak(filtVals);
    const rawEnergy = energy(rawVals);
    const filtEnergy = energy(filtVals);
    const rawMean = mean(rawVals);
    const filtMean = mean(filtVals);

    // Noise estimation: difference between raw and filtered
    const noiseVals = rawVals.map((v, i) => v - filtVals[i]);
    const noiseRms = rms(noiseVals);

    // SNR = 20 * log10(signalRMS / noiseRMS)
    const snrBefore = noiseRms > 0 ? 20 * Math.log10(rawRms / noiseRms) : Infinity;
    const snrAfter = noiseRms > 0 ? 20 * Math.log10(filtRms / noiseRms) : Infinity;

    const noiseRemoved = rawEnergy > 0
        ? ((rawEnergy - filtEnergy) / rawEnergy * 100)
        : 0;

    return {
        raw: {
            rms: parseFloat(rawRms.toFixed(6)),
            peak: parseFloat(rawPeak.toFixed(6)),
            energy: parseFloat(rawEnergy.toFixed(6)),
            mean: parseFloat(rawMean.toFixed(6)),
            samples: rawVals.length
        },
        filtered: {
            rms: parseFloat(filtRms.toFixed(6)),
            peak: parseFloat(filtPeak.toFixed(6)),
            energy: parseFloat(filtEnergy.toFixed(6)),
            mean: parseFloat(filtMean.toFixed(6)),
            samples: filtVals.length
        },
        improvement: {
            snrBefore: parseFloat(snrBefore.toFixed(2)),
            snrAfter: parseFloat(snrAfter.toFixed(2)),
            noiseRemovedPercent: parseFloat(Math.max(0, noiseRemoved).toFixed(2)),
            rmsReduction: parseFloat(((1 - filtRms / rawRms) * 100).toFixed(2)),
            peakReduction: parseFloat(((1 - filtPeak / rawPeak) * 100).toFixed(2))
        }
    };
}

// ── Apply filter to data for both axes ──
function applyFilter(data, noiseProfile, method, params) {
    let filteredY, filteredZ;

    switch (method) {
        case 'mean_subtraction':
            filteredY = filterMeanSubtraction(data, noiseProfile, 'y');
            filteredZ = filterMeanSubtraction(filteredY, noiseProfile, 'z');
            return filteredZ;

        case 'threshold_gate':
            filteredY = filterThresholdGate(data, noiseProfile, 'y', params.sigmaMultiplier || 3);
            filteredZ = filterThresholdGate(filteredY, noiseProfile, 'z', params.sigmaMultiplier || 3);
            return filteredZ;

        case 'moving_average':
            filteredY = filterMovingAverage(data, 'y', params.windowSize || 5);
            filteredZ = filterMovingAverage(filteredY, 'z', params.windowSize || 5);
            return filteredZ;

        case 'spectral_subtraction':
            filteredY = filterSpectralSubtraction(data, noiseProfile, 'y', params.subtractionFactor || 1.0);
            filteredZ = filterSpectralSubtraction(filteredY, noiseProfile, 'z', params.subtractionFactor || 1.0);
            return filteredZ;

        case 'bandpass':
            filteredY = filterBandpass(data, 'y', params.lowCutoff || 0.5, params.highCutoff || 5.0);
            filteredZ = filterBandpass(filteredY, 'z', params.lowCutoff || 0.5, params.highCutoff || 5.0);
            return filteredZ;

        default:
            return data;
    }
}

// ═══════════════════════════════════════════════════════════════
// @desc    Apply filter to train event data using noise profiles (both sensors)
// @route   POST /api/filter/apply
// @access  Public
// ═══════════════════════════════════════════════════════════════
router.post('/apply', async (req, res) => {
    try {
        const {
            eventId,
            profileId,       // profile for the primary sensor (or left sensor)
            profileId2,      // optional: profile for the second sensor; falls back to profileId
            method = 'threshold_gate',
            params = {},
            bufferBefore = 10,
            bufferAfter = 10
        } = req.body;

        if (!eventId || !profileId) {
            return res.status(400).json({
                success: false,
                message: 'eventId and profileId are required'
            });
        }

        // Fetch event and profiles in parallel
        const profileIds = [profileId];
        if (profileId2 && profileId2 !== profileId) profileIds.push(profileId2);

        const [event, ...profileDocs] = await Promise.all([
            TrainEvent.findById(eventId).lean(),
            ...profileIds.map(id => NoiseProfile.findById(id).lean())
        ]);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Train event not found' });
        }

        const profile1 = profileDocs[0]; // primary / left
        const profile2 = profileDocs.length > 1 ? profileDocs[1] : profile1; // secondary / right (fallback to same)

        if (!profile1) {
            return res.status(404).json({ success: false, message: 'Noise profile not found' });
        }

        // Determine which profile goes with which sensor
        // profile1 -> sensor2 (left), profile2 -> sensor1 (right)
        // But if profiles specify their own sensorId, respect that
        const leftProfile = profile1.sensorId === 'sensor1' ? (profile2 || profile1) : profile1;
        const rightProfile = profile1.sensorId === 'sensor1' ? profile1 : (profile2 || profile1);

        // Compute time window
        const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
        const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

        // Fetch ALL sensor records (both sensors) in one query
        const allRecords = await MqttRecord.find({
            station: event.station.toLowerCase(),
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: windowStart, $lte: windowEnd }
        }).sort({ receivedAt: 1 }).limit(100000).lean();

        if (allRecords.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No sensor records found in this event window'
            });
        }

        // Split by sensor
        const sensor1Records = allRecords.filter(r => r.sensorId === 'sensor1');
        const sensor2Records = allRecords.filter(r => r.sensorId === 'sensor2');

        // Reconstruct timestamps with common anchor
        const rawDataLeft = reconstructTimestamps(allRecords, sensor2Records);   // sensor2 = Left
        const rawDataRight = reconstructTimestamps(allRecords, sensor1Records);  // sensor1 = Right

        // Apply filters to each sensor
        const filteredLeft = rawDataLeft.length > 0
            ? applyFilter(rawDataLeft, leftProfile, method, params)
            : [];
        const filteredRight = rawDataRight.length > 0
            ? applyFilter(rawDataRight, rightProfile, method, params)
            : [];

        // Compute metrics per sensor per axis
        const computeSensorMetrics = (raw, filtered) => {
            if (raw.length === 0 || filtered.length === 0) {
                return { y: null, z: null };
            }
            return {
                y: computeMetrics(raw, filtered, 'y'),
                z: computeMetrics(raw, filtered, 'z')
            };
        };

        const metricsLeft = computeSensorMetrics(rawDataLeft, filteredLeft);
        const metricsRight = computeSensorMetrics(rawDataRight, filteredRight);

        // Downsample for response if too large (keep max 3000 points per sensor)
        const maxPoints = 3000;
        const downsample = (arr) => {
            if (arr.length <= maxPoints) return arr;
            const step = arr.length / maxPoints;
            const result = [];
            for (let i = 0; i < maxPoints; i++) {
                result.push(arr[Math.floor(i * step)]);
            }
            return result;
        };

        res.json({
            success: true,
            event: {
                _id: event._id,
                startTime: event.startTime,
                endTime: event.endTime,
                duration: event.duration,
                direction: event.direction,
                type: event.type
            },
            profiles: {
                left: {
                    _id: leftProfile._id,
                    sensorId: leftProfile.sensorId,
                    recordedAt: leftProfile.recordedAt,
                    durationSeconds: leftProfile.durationSeconds,
                    accelerationNoise: leftProfile.accelerationNoise,
                    voltageFluctuations: leftProfile.voltageFluctuations,
                    dominantFrequencies: leftProfile.dominantFrequencies
                },
                right: {
                    _id: rightProfile._id,
                    sensorId: rightProfile.sensorId,
                    recordedAt: rightProfile.recordedAt,
                    durationSeconds: rightProfile.durationSeconds,
                    accelerationNoise: rightProfile.accelerationNoise,
                    voltageFluctuations: rightProfile.voltageFluctuations,
                    dominantFrequencies: rightProfile.dominantFrequencies
                }
            },
            filter: {
                method,
                params
            },
            window: {
                start: windowStart,
                end: windowEnd,
                startIST: toIST(windowStart),
                endIST: toIST(windowEnd)
            },
            left: {
                rawData: downsample(rawDataLeft),
                filteredData: downsample(filteredLeft),
                totalSamples: rawDataLeft.length,
                metrics: metricsLeft
            },
            right: {
                rawData: downsample(rawDataRight),
                filteredData: downsample(filteredRight),
                totalSamples: rawDataRight.length,
                metrics: metricsRight
            }
        });

    } catch (err) {
        console.error('Filter apply error:', err);
        res.status(500).json({ success: false, message: 'Internal server error during filtering' });
    }
});

// ═══════════════════════════════════════════════════════════════
// @desc    Auto-match closest noise profiles for both sensors
// @route   GET /api/filter/preview/:eventId
// @access  Public
// ═══════════════════════════════════════════════════════════════
router.get('/preview/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;

        const event = await TrainEvent.findById(eventId).lean();
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        // Find profiles for both sensors
        const [leftProfiles, rightProfiles] = await Promise.all([
            NoiseProfile.find({ sensorId: 'sensor2' }).sort({ recordedAt: -1 }).lean(),
            NoiseProfile.find({ sensorId: 'sensor1' }).sort({ recordedAt: -1 }).lean()
        ]);

        // Find closest profile by date for each sensor
        const eventTime = new Date(event.startTime).getTime();

        const findClosest = (profiles) => {
            if (profiles.length === 0) return null;
            let closest = profiles[0];
            let closestDist = Math.abs(new Date(profiles[0].recordedAt).getTime() - eventTime);
            for (const p of profiles) {
                const dist = Math.abs(new Date(p.recordedAt).getTime() - eventTime);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = p;
                }
            }
            return { profile: closest, distance: closestDist };
        };

        const leftMatch = findClosest(leftProfiles);
        const rightMatch = findClosest(rightProfiles);

        const formatMatch = (match) => {
            if (!match) return null;
            return {
                _id: match.profile._id,
                sensorId: match.profile.sensorId,
                recordedAt: match.profile.recordedAt,
                localTime: match.profile.localTime,
                durationSeconds: match.profile.durationSeconds,
                samplesCount: match.profile.samplesCount,
                accelerationNoise: match.profile.accelerationNoise,
                voltageFluctuations: match.profile.voltageFluctuations,
                dominantFrequencies: match.profile.dominantFrequencies,
                notes: match.profile.notes,
                matchDistance: {
                    milliseconds: match.distance,
                    hours: parseFloat((match.distance / 3600000).toFixed(2)),
                    description: match.distance < 3600000 ? 'Excellent (< 1 hour)'
                        : match.distance < 86400000 ? 'Good (< 24 hours)'
                        : 'Stale (> 24 hours — consider recalibrating)'
                }
            };
        };

        // Combine all profiles for the dropdown
        const allProfiles = [...leftProfiles, ...rightProfiles]
            .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
            .map(p => ({
                _id: p._id,
                sensorId: p.sensorId,
                recordedAt: p.recordedAt,
                localTime: p.localTime,
                durationSeconds: p.durationSeconds,
                notes: p.notes
            }));

        res.json({
            success: true,
            event: {
                _id: event._id,
                startTime: event.startTime,
                endTime: event.endTime,
                duration: event.duration,
                type: event.type,
                direction: event.direction,
                startTimeIST: event.startTimeIST
            },
            matchedProfiles: {
                left: formatMatch(leftMatch),
                right: formatMatch(rightMatch)
            },
            allProfiles
        });

    } catch (err) {
        console.error('Filter preview error:', err);
        res.status(500).json({ success: false, message: 'Failed to preview filter' });
    }
});

// ═══════════════════════════════════════════════════════════════
// @desc    Save filtered (noise-free) data to FilteredRecord collection
// @route   POST /api/filter/save
// @access  Public
// ═══════════════════════════════════════════════════════════════
router.post('/save', async (req, res) => {
    try {
        const {
            eventId,
            profileId,
            method,
            params = {},
            bufferBefore = 10,
            bufferAfter = 10,
            notes = ''
        } = req.body;

        if (!eventId || !profileId || !method) {
            return res.status(400).json({
                success: false,
                message: 'eventId, profileId, and method are required'
            });
        }

        // Fetch event and profile
        const [event, profile] = await Promise.all([
            TrainEvent.findById(eventId).lean(),
            NoiseProfile.findById(profileId).lean()
        ]);

        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

        const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
        const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

        // Fetch all sensor records
        const allRecords = await MqttRecord.find({
            station: event.station.toLowerCase(),
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: windowStart, $lte: windowEnd }
        }).sort({ receivedAt: 1 }).limit(100000).lean();

        if (allRecords.length === 0) {
            return res.status(404).json({ success: false, message: 'No sensor records found' });
        }

        const sensor1Records = allRecords.filter(r => r.sensorId === 'sensor1');
        const sensor2Records = allRecords.filter(r => r.sensorId === 'sensor2');

        const rawLeft = reconstructTimestamps(allRecords, sensor2Records);
        const rawRight = reconstructTimestamps(allRecords, sensor1Records);

        // Apply filters
        const filtLeft = rawLeft.length > 0 ? applyFilter(rawLeft, profile, method, params) : [];
        const filtRight = rawRight.length > 0 ? applyFilter(rawRight, profile, method, params) : [];

        // Build metrics helper
        const buildMetrics = (raw, filt, axis) => {
            if (raw.length === 0 || filt.length === 0) return null;
            const m = computeMetrics(raw, filt, axis);
            return {
                rawRms: m.raw.rms,
                filteredRms: m.filtered.rms,
                rmsReduction: m.improvement.rmsReduction,
                rawPeak: m.raw.peak,
                filteredPeak: m.filtered.peak,
                peakReduction: m.improvement.peakReduction,
                noiseRemovedPercent: m.improvement.noiseRemovedPercent,
                snrBefore: m.improvement.snrBefore,
                snrAfter: m.improvement.snrAfter
            };
        };

        const savedRecords = [];

        // Save left sensor (sensor2)
        if (filtLeft.length > 0) {
            const leftDoc = {
                eventId: event._id,
                profileId: profile._id,
                sensor: 'left',
                sensorId: 'sensor2',
                station: event.station,
                filterMethod: method,
                filterParams: params,
                eventStartTime: event.startTime,
                eventEndTime: event.endTime,
                eventDuration: event.duration,
                data: filtLeft.map(d => ({
                    t: new Date(d.t),
                    y_g: d.y_g,
                    z_g: d.z_g,
                    y_v: d.y_v,
                    z_v: d.z_v
                })),
                metrics: {
                    y: buildMetrics(rawLeft, filtLeft, 'y'),
                    z: buildMetrics(rawLeft, filtLeft, 'z')
                },
                totalSamples: filtLeft.length,
                savedAt: new Date(),
                localTime: toIST(new Date()),
                notes
            };

            const saved = await FilteredRecord.findOneAndUpdate(
                { eventId: event._id, sensor: 'left', filterMethod: method },
                leftDoc,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            savedRecords.push({ sensor: 'left', id: saved._id, samples: filtLeft.length });
        }

        // Save right sensor (sensor1)
        if (filtRight.length > 0) {
            const rightDoc = {
                eventId: event._id,
                profileId: profile._id,
                sensor: 'right',
                sensorId: 'sensor1',
                station: event.station,
                filterMethod: method,
                filterParams: params,
                eventStartTime: event.startTime,
                eventEndTime: event.endTime,
                eventDuration: event.duration,
                data: filtRight.map(d => ({
                    t: new Date(d.t),
                    y_g: d.y_g,
                    z_g: d.z_g,
                    y_v: d.y_v,
                    z_v: d.z_v
                })),
                metrics: {
                    y: buildMetrics(rawRight, filtRight, 'y'),
                    z: buildMetrics(rawRight, filtRight, 'z')
                },
                totalSamples: filtRight.length,
                savedAt: new Date(),
                localTime: toIST(new Date()),
                notes
            };

            const saved = await FilteredRecord.findOneAndUpdate(
                { eventId: event._id, sensor: 'right', filterMethod: method },
                rightDoc,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            savedRecords.push({ sensor: 'right', id: saved._id, samples: filtRight.length });
        }

        res.json({
            success: true,
            message: `Saved ${savedRecords.length} filtered dataset(s)`,
            saved: savedRecords,
            event: { _id: event._id, startTime: event.startTime },
            filterMethod: method,
            filterParams: params
        });

    } catch (err) {
        // Handle duplicate key gracefully
        if (err.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Filtered data for this event/sensor/filter already exists. It has been updated.'
            });
        }
        console.error('Filter save error:', err);
        res.status(500).json({ success: false, message: 'Failed to save filtered data' });
    }
});

// ═══════════════════════════════════════════════════════════════
// @desc    List saved filtered datasets
// @route   GET /api/filter/saved
// @access  Public
// @query   eventId (optional), limit (default 50)
// ═══════════════════════════════════════════════════════════════
router.get('/saved', async (req, res) => {
    try {
        const query = {};
        if (req.query.eventId) query.eventId = req.query.eventId;

        const records = await FilteredRecord.find(query)
            .select('-data')  // exclude the big data array for listing
            .sort({ savedAt: -1 })
            .limit(parseInt(req.query.limit) || 50)
            .populate('eventId', 'startTime endTime duration type direction station')
            .lean();

        res.json({ success: true, count: records.length, data: records });
    } catch (err) {
        console.error('List filtered error:', err);
        res.status(500).json({ success: false, message: 'Failed to list filtered records' });
    }
});

// ═══════════════════════════════════════════════════════════════
// @desc    Delete a saved filtered dataset
// @route   DELETE /api/filter/saved/:id
// @access  Public
// ═══════════════════════════════════════════════════════════════
router.delete('/saved/:id', async (req, res) => {
    try {
        const deleted = await FilteredRecord.findByIdAndDelete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }
        res.json({ success: true, message: 'Filtered record deleted' });
    } catch (err) {
        console.error('Delete filtered error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete record' });
    }
});

module.exports = router;
