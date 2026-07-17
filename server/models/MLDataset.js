const mongoose = require('mongoose');

const mlDatasetSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainEvent',
        required: true
    },
    sensorId: {
        type: String,
        required: true
    },
    label: {
        type: Number,
        required: true,
        enum: [0, 1] // 0 = Idle/Noise, 1 = Train Approaching
    },
    // The exact moment this data window starts
    windowStartTime: {
        type: Date,
        required: true
    },
    // Features extracted from the window
    features: {
        meanEnergy: { type: Number, required: true },
        maxEnergy: { type: Number, required: true },
        energySlope: { type: Number, required: true }
    },
    // Meta information about the split
    split: {
        type: String,
        enum: ['train', 'test'],
        default: 'train'
    },
    // We store the actual envelope data to plot it later
    envelopeData: [{
        timeOffsetSec: Number,
        energy: Number
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('MLDataset', mlDatasetSchema);
