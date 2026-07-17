const mongoose = require('mongoose');

const mqttRecordSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        index: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    rawPayload: {
        type: String
    },
    station: {
        type: String,
        index: true
    },
    sensorId: {
        type: String
    },
    receivedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    localTime: {
        type: String  // Human-readable IST timestamp e.g. "2026-06-15 21:49:49.123 IST"
    }
});

// Compound index for efficient time-range queries per topic
mqttRecordSchema.index({ topic: 1, receivedAt: -1 });
// Compound index for station-based queries
mqttRecordSchema.index({ station: 1, receivedAt: -1 });

module.exports = mongoose.model('MqttRecord', mqttRecordSchema);
