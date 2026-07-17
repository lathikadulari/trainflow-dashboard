/**
 * Batch analyze direction for all events that don't have one.
 * This replays sensor data through the DirectionDetector for each event.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TrainEvent = require('../models/TrainEvent');
const MqttRecord = require('../models/MqttRecord');
const DirectionDetector = require('../services/directionDetector');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trainflow');
    console.log('Connected to MongoDB');

    const events = await TrainEvent.find({
        endTime: { $exists: true, $ne: null }
    }).sort({ startTime: -1 });

    console.log(`Found ${events.length} events to analyze\n`);

    let analyzed = 0, skipped = 0;

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
            console.log(`  SKIP: ${event.startTimeIST || event.startTime} | ${records.length} records (too few)`);
            skipped++;
            continue;
        }

        const detector = new DirectionDetector(event.station || 'Makumbura');
        for (const record of records) {
            if (!record.payload) continue;
            const ts = record.receivedAt ? new Date(record.receivedAt).getTime() : undefined;
            detector.onSensorData(record.sensorId, {
                z_g: record.payload.z_g ?? 0,
                y_g: record.payload.y_g ?? 0,
                t_us: record.payload.t_us ?? 0
            }, ts);
        }

        const result = await detector.finalizeDirection(event._id);
        analyzed++;

        console.log(`  ✅ ${event.startTimeIST || event.startTime} | ${result.direction} | confidence: ${result.confidence}% | delay: ${result.propagationDelayMs?.toFixed(1) || '?'}ms | records: ${records.length}`);
    }

    console.log(`\n🎉 Done! Analyzed: ${analyzed}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
