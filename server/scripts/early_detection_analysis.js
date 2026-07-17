require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Event = require('../models/TrainEvent');
const MqttRecord = require('../models/MqttRecord');
const { computeFFT } = require('../services/mqttService');

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/trainflow');
        console.log('Connected to MongoDB');

        // Find a recent long 'stopped' event
        const events = await Event.find({ type: 'stopped' }).sort({ startTime: -1 }).limit(2);
        
        for (const ev of events) {
            console.log(`\n=== Analyzing Event: ${ev._id} (${ev.startTime.toISOString()}) ===`);
            
            // Get data for this event (sensor2 for now)
            const records = await MqttRecord.find({
                station: 'makumbura',
                sensorId: 'sensor2',
                receivedAt: { $gte: ev.startTime, $lte: ev.endTime }
            }).sort({ receivedAt: 1 }).lean();

            if (records.length < 100) {
                console.log('Not enough records.');
                continue;
            }

            // Estimate sample rate
            const durationSec = (records[records.length-1].receivedAt - records[0].receivedAt) / 1000;
            const sampleRate = records.length / durationSec;
            console.log(`Sample Rate: ${sampleRate.toFixed(1)} Hz, Total Samples: ${records.length}, Duration: ${durationSec.toFixed(1)}s`);

            // Phase 1: Distant Arrival (First 20 seconds)
            const earlyRecords = records.filter(r => (r.receivedAt - ev.startTime) / 1000 <= 20);
            const earlyZ = earlyRecords.map(r => r.payload.z_g || 0);
            
            // Sub-mean (DC block)
            const earlyZMean = earlyZ.reduce((a,b) => a+b, 0) / earlyZ.length;
            const earlyZCentered = earlyZ.map(v => v - earlyZMean);

            const fftEarly = computeFFT(earlyZCentered, sampleRate);
            fftEarly.sort((a,b) => b.magnitude - a.magnitude);
            console.log(`\n[EARLY ARRIVAL PHASE - First 20s] Dominant Frequencies (Z-Axis):`);
            fftEarly.slice(0, 5).forEach((pt, i) => {
                console.log(`  ${i+1}. ${pt.frequency.toFixed(2)} Hz (Mag: ${pt.magnitude.toFixed(4)})`);
            });

            // Phase 2: Peak Energy (Find the 10-second window with highest variance)
            let peakStartIdx = 0;
            let maxVar = 0;
            const windowSize = Math.floor(sampleRate * 10); // 10 seconds
            for (let i = 0; i < records.length - windowSize; i += windowSize) {
                const slice = records.slice(i, i+windowSize).map(r => r.payload.z_g || 0);
                const mean = slice.reduce((a,b)=>a+b,0)/slice.length;
                const variance = slice.reduce((a,b)=>a+Math.pow(b-mean,2),0)/slice.length;
                if (variance > maxVar) {
                    maxVar = variance;
                    peakStartIdx = i;
                }
            }

            const peakRecords = records.slice(peakStartIdx, peakStartIdx + windowSize);
            const peakZ = peakRecords.map(r => r.payload.z_g || 0);
            const peakZMean = peakZ.reduce((a,b) => a+b, 0) / peakZ.length;
            const peakZCentered = peakZ.map(v => v - peakZMean);

            const fftPeak = computeFFT(peakZCentered, sampleRate);
            fftPeak.sort((a,b) => b.magnitude - a.magnitude);
            console.log(`\n[PEAK ARRIVAL PHASE - 10s Window] Dominant Frequencies (Z-Axis):`);
            fftPeak.slice(0, 5).forEach((pt, i) => {
                console.log(`  ${i+1}. ${pt.frequency.toFixed(2)} Hz (Mag: ${pt.magnitude.toFixed(4)})`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
}
run();
