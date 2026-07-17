const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const TrainEvent = require('../models/TrainEvent');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const ev = await TrainEvent.findOne({ startTimeIST: /08:04/ }).lean();
    if (ev) {
        console.log(`Direction: ${ev.direction}`);
        console.log(`Confidence: ${ev.directionConfidence}%`);
        console.log(`Methods:`);
        ev.directionMeta?.methods?.forEach(m => {
            console.log(`  ${m.name}: ${m.result} (${m.deltaMs.toFixed(1)}ms)`);
        });
        console.log(`Votes: L=${ev.directionMeta?.votesLeft} R=${ev.directionMeta?.votesRight}`);
        console.log(`First sensor: ${ev.directionMeta?.firstSensor}`);
        console.log(`Stronger: ${ev.directionMeta?.strongerSensor}`);
    }
    await mongoose.disconnect();
})();
