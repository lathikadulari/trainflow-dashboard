const mongoose = require('mongoose');

const noiseMetricSchema = new mongoose.Schema({
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    mean: { type: Number, required: true },
    stdDev: { type: Number, required: true },
    vpp: { type: Number }, // Peak-to-Peak voltage (for voltage measurements)
    rms: { type: Number }  // Root Mean Square (for acceleration measurements)
}, { _id: false });

const fftPointSchema = new mongoose.Schema({
    frequency: { type: Number, required: true },
    magnitude: { type: Number, required: true }
}, { _id: false });

const noiseProfileSchema = new mongoose.Schema({
    station: {
        type: String,
        default: 'Makumbura',
        index: true
    },
    sensorId: {
        type: String,
        required: true,
        index: true
    },
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    durationSeconds: {
        type: Number,
        required: true
    },
    samplesCount: {
        type: Number,
        required: true
    },
    voltageFluctuations: {
        y: { type: noiseMetricSchema, required: true },
        z: { type: noiseMetricSchema, required: true }
    },
    accelerationNoise: {
        y: { type: noiseMetricSchema, required: true },
        z: { type: noiseMetricSchema, required: true }
    },
    dominantFrequencies: {
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 }
    },
    fftSpectrum: {
        y: [fftPointSchema],
        z: [fftPointSchema]
    },
    notes: {
        type: String,
        default: ''
    },
    recordedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    localTime: {
        type: String
    }
});

// Index for query filtering
noiseProfileSchema.index({ station: 1, sensorId: 1, recordedAt: -1 });

module.exports = mongoose.model('NoiseProfile', noiseProfileSchema);
