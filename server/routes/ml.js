const express = require('express');
const router = express.Router();
const TrainEvent = require('../models/TrainEvent');
const MqttRecord = require('../models/MqttRecord');
const MLDataset = require('../models/MLDataset');
const { computeFFT } = require('../services/mqttService');

// ── 1. GENERATE DATASET ──────────────────────────────────────────────
router.post('/generate', async (req, res) => {
    try {
        const { sensorId = 'sensor2' } = req.body;
        
        // Find long stopped events
        const events = await TrainEvent.find({ type: 'stopped' }).sort({ startTime: -1 }).limit(5).lean();
        if (events.length === 0) return res.json({ success: false, message: 'No events found' });

        await MLDataset.deleteMany({ sensorId }); // Clear old dataset for this sensor

        let generatedCount = 0;

        for (const ev of events) {
            const records = await MqttRecord.find({
                station: 'makumbura',
                sensorId,
                receivedAt: { $gte: ev.startTime, $lte: ev.endTime }
            }).sort({ receivedAt: 1 }).lean();

            if (records.length < 500) continue; // Need enough data

            const durationSec = (records[records.length-1].receivedAt - records[0].receivedAt) / 1000;
            const sampleRate = records.length / durationSec;
            
            // Generate Energy Envelope using Spectral Bandpass (1.8 - 3.5 Hz)
            const windowSize = Math.floor(sampleRate * 2.0); // 2 second FFT window
            const stepSize = Math.floor(sampleRate * 0.5);   // 0.5 sec step
            
            const envelope = []; // { timeOffset, energy }

            for (let i = 0; i < records.length - windowSize; i += stepSize) {
                const slice = records.slice(i, i + windowSize);
                const tOff = (slice[0].receivedAt - ev.startTime) / 1000;
                
                const zVals = slice.map(r => r.payload.z_g || 0);
                const zMean = zVals.reduce((a,b)=>a+b,0)/zVals.length;
                const zCentered = zVals.map(v => v - zMean);
                
                const fft = computeFFT(zCentered, sampleRate);
                
                // Bandpass Energy (sum of magnitudes between 1.8Hz and 3.5Hz)
                let bpEnergy = 0;
                fft.forEach(pt => {
                    if (pt.frequency >= 1.8 && pt.frequency <= 3.5) {
                        bpEnergy += pt.magnitude;
                    }
                });
                
                envelope.push({ timeOffsetSec: tOff, energy: bpEnergy });
            }

            // Smooth the envelope (Moving average over 5 steps)
            const smoothedEnvelope = [];
            for (let i = 0; i < envelope.length; i++) {
                let sum = 0;
                let count = 0;
                for (let j = Math.max(0, i-4); j <= i; j++) {
                    sum += envelope[j].energy;
                    count++;
                }
                smoothedEnvelope.push({
                    timeOffsetSec: envelope[i].timeOffsetSec,
                    energy: sum / count
                });
            }

            // Find global peak in envelope to anchor our windows
            let peakIdx = 0;
            let peakE = 0;
            smoothedEnvelope.forEach((pt, idx) => {
                if (pt.energy > peakE) { peakE = pt.energy; peakIdx = idx; }
            });
            const peakTime = smoothedEnvelope[peakIdx].timeOffsetSec;

            // Extract features function
            const extractFeatures = (envSlice) => {
                if(envSlice.length === 0) return null;
                const energies = envSlice.map(p => p.energy);
                const mean = energies.reduce((a,b)=>a+b,0)/energies.length;
                const max = Math.max(...energies);
                // slope = delta Y / delta X
                const slope = (energies[energies.length-1] - energies[0]) / 
                              (envSlice[envSlice.length-1].timeOffsetSec - envSlice[0].timeOffsetSec);
                return { meanEnergy: mean, maxEnergy: max, energySlope: slope };
            };

            // Window 1: IDLE (Label 0) -> Long before the peak (e.g., from 0s to 20s)
            const idleWindow = smoothedEnvelope.filter(p => p.timeOffsetSec >= 0 && p.timeOffsetSec <= 20);
            const idleFeatures = extractFeatures(idleWindow);
            if (idleFeatures) {
                await MLDataset.create({
                    eventId: ev._id,
                    sensorId,
                    label: 0,
                    windowStartTime: new Date(ev.startTime.getTime() + 0),
                    features: idleFeatures,
                    split: 'train', // Using 100% for training
                    envelopeData: idleWindow
                });
                generatedCount++;
            }

            // Window 2: APPROACHING (Label 1) -> The 20 seconds immediately before the peak
            const approachWindow = smoothedEnvelope.filter(p => p.timeOffsetSec >= (peakTime - 25) && p.timeOffsetSec <= (peakTime - 5));
            const approachFeatures = extractFeatures(approachWindow);
            if (approachFeatures && approachWindow.length > 5) {
                await MLDataset.create({
                    eventId: ev._id,
                    sensorId,
                    label: 1,
                    windowStartTime: new Date(ev.startTime.getTime() + (peakTime - 25)*1000),
                    features: approachFeatures,
                    split: 'train', // Using 100% for training
                    envelopeData: approachWindow
                });
                generatedCount++;
            }
            
            // Let's also grab a mid-approach window (1) and another idle window (0) for more data
            const idleWindow2 = smoothedEnvelope.filter(p => p.timeOffsetSec >= 25 && p.timeOffsetSec <= 45);
            if (idleWindow2.length > 5 && (idleWindow2[idleWindow2.length-1].timeOffsetSec < peakTime - 40)) {
                await MLDataset.create({
                    eventId: ev._id, sensorId, label: 0,
                    windowStartTime: new Date(ev.startTime.getTime() + 25000),
                    features: extractFeatures(idleWindow2),
                    split: 'train', // Using 100% for training
                    envelopeData: idleWindow2
                });
                generatedCount++;
            }
        }

        res.json({ success: true, message: `Generated ${generatedCount} ML samples`, count: generatedCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ── 2. TRAIN LOGISTIC REGRESSION MODEL ───────────────────────────────
// A simple Logistic Regression implementation (Gradient Descent)
class LogisticRegression {
    constructor(lr = 0.01, iters = 1000) {
        this.lr = lr;
        this.iters = iters;
        this.weights = [];
        this.bias = 0;
    }
    sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
    
    fit(X, y) {
        const n_samples = X.length;
        const n_features = X[0].length;
        this.weights = new Array(n_features).fill(0);
        this.bias = 0;

        for (let i = 0; i < this.iters; i++) {
            let dw = new Array(n_features).fill(0);
            let db = 0;
            for (let j = 0; j < n_samples; j++) {
                // z = w.x + b
                let z = this.bias;
                for (let k = 0; k < n_features; k++) z += this.weights[k] * X[j][k];
                const y_pred = this.sigmoid(z);
                
                const dz = y_pred - y[j];
                db += dz;
                for (let k = 0; k < n_features; k++) dw[k] += dz * X[j][k];
            }
            this.bias -= this.lr * (db / n_samples);
            for (let k = 0; k < n_features; k++) this.weights[k] -= this.lr * (dw[k] / n_samples);
        }
    }
    
    predict_proba(x) {
        let z = this.bias;
        for (let k = 0; k < x.length; k++) z += this.weights[k] * x[k];
        return this.sigmoid(z);
    }
}

router.post('/train', async (req, res) => {
    try {
        const { sensorId = 'sensor2' } = req.body;
        const dataset = await MLDataset.find({ sensorId }).lean();
        if (dataset.length === 0) return res.json({ success: false, message: 'No dataset found' });

        // Normalize features
        const allMeans = dataset.map(d => d.features.meanEnergy);
        const allSlopes = dataset.map(d => d.features.energySlope);
        
        const meanMax = Math.max(...allMeans);
        const slopeMax = Math.max(...allSlopes.map(Math.abs));

        const getX = (d) => [
            d.features.meanEnergy / (meanMax || 1),
            d.features.energySlope / (slopeMax || 1)
        ];

        const trainData = dataset.filter(d => d.split === 'train');
        const testData = dataset.filter(d => d.split === 'test');

        if (trainData.length === 0) return res.json({ success: false, message: 'No training data' });

        const X_train = trainData.map(getX);
        const y_train = trainData.map(d => d.label);
        
        const model = new LogisticRegression(0.5, 2000);
        model.fit(X_train, y_train);

        // Evaluate
        const evaluate = (data) => {
            let tp = 0, fp = 0, tn = 0, fn = 0;
            data.forEach(d => {
                const prob = model.predict_proba(getX(d));
                const pred = prob >= 0.5 ? 1 : 0;
                if (d.label === 1 && pred === 1) tp++;
                if (d.label === 0 && pred === 1) fp++;
                if (d.label === 0 && pred === 0) tn++;
                if (d.label === 1 && pred === 0) fn++;
            });
            const acc = (tp + tn) / data.length || 0;
            const prec = tp / (tp + fp) || 0;
            const rec = tp / (tp + fn) || 0;
            return { accuracy: acc, precision: prec, recall: rec, confusion: { tp, fp, tn, fn } };
        };

        const trainMetrics = evaluate(trainData);
        const testMetrics = testData.length > 0 ? evaluate(testData) : null;

        res.json({
            success: true,
            model: { weights: model.weights, bias: model.bias, normalization: { meanMax, slopeMax } },
            trainMetrics,
            testMetrics,
            dataPoints: dataset.map(d => ({
                id: d._id,
                split: d.split,
                label: d.label,
                meanEnergy: d.features.meanEnergy,
                energySlope: d.features.energySlope,
                probability: model.predict_proba(getX(d)),
                envelopeData: d.envelopeData
            }))
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
