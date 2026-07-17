const mongoose = require('mongoose');

const trainEventSchema = new mongoose.Schema({
    station: {
        type: String,
        default: 'Makumbura'
    },
    type: {
        type: String,
        enum: ['approaching', 'stopped'],
        required: true
    },
    startTime: {
        type: Date,
        required: true
    },
    startTimeIST: {
        type: String  // "2026-06-15 21:49:49.123 IST"
    },
    endTime: {
        type: Date,
        default: null
    },
    endTimeIST: {
        type: String,
        default: null
    },
    duration: {
        type: Number,   // milliseconds
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    direction: {
        type: String,
        enum: ['left_to_right', 'right_to_left', 'unknown'],
        default: 'unknown'
    },
    directionConfidence: {
        type: Number,   // 0-100%
        default: 0
    },
    directionMeta: {
        propagationDelayMs: { type: Number, default: null },
        firstSensor: { type: String, default: null },      // 'sensor1' (right) or 'sensor2' (left)
        strongerSensor: { type: String, default: null },
        votesLeft: { type: Number, default: 0 },
        votesRight: { type: Number, default: 0 },
        methods: [{
            name: String,
            result: String,   // 'LEFT' or 'RIGHT'
            deltaMs: Number
        }]
    }
});

// Index for active event lookups and time-range queries
trainEventSchema.index({ station: 1, active: 1 });
trainEventSchema.index({ startTime: -1 });
trainEventSchema.index({ station: 1, startTime: -1 });

module.exports = mongoose.model('TrainEvent', trainEventSchema);
