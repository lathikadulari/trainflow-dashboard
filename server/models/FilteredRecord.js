const mongoose = require('mongoose');

/**
 * FilteredRecord — stores noise-removed (clean) sensor data.
 * 
 * Created when the user applies a filter to a train event's raw data
 * on the Noise Filter page and clicks "Save". This preserves the
 * denoised signal in a separate collection for downstream analysis
 * without modifying the original MqttRecord data.
 */
const FilteredRecordSchema = new mongoose.Schema({
    // Link back to the source event
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainEvent',
        required: true,
        index: true
    },
    // Link to the noise profile used for filtering
    profileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'NoiseProfile',
        required: true
    },
    // Which sensor: 'left' (sensor2) or 'right' (sensor1)
    sensor: {
        type: String,
        enum: ['left', 'right'],
        required: true
    },
    sensorId: {
        type: String,  // 'sensor1' or 'sensor2'
        required: true
    },
    station: {
        type: String,
        required: true
    },
    // Filter configuration used
    filterMethod: {
        type: String,
        enum: ['mean_subtraction', 'threshold_gate', 'moving_average', 'spectral_subtraction', 'bandpass'],
        required: true
    },
    filterParams: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    // Event timing
    eventStartTime: Date,
    eventEndTime: Date,
    eventDuration: Number,

    // The clean (filtered) signal data points
    data: [{
        t: Date,
        y_g: Number,
        z_g: Number,
        y_v: Number,
        z_v: Number
    }],

    // Metrics from the filtering process
    metrics: {
        y: {
            rawRms: Number,
            filteredRms: Number,
            rmsReduction: Number,
            rawPeak: Number,
            filteredPeak: Number,
            peakReduction: Number,
            noiseRemovedPercent: Number,
            snrBefore: Number,
            snrAfter: Number
        },
        z: {
            rawRms: Number,
            filteredRms: Number,
            rmsReduction: Number,
            rawPeak: Number,
            filteredPeak: Number,
            peakReduction: Number,
            noiseRemovedPercent: Number,
            snrBefore: Number,
            snrAfter: Number
        }
    },

    totalSamples: Number,

    // When this filtered dataset was created
    savedAt: {
        type: Date,
        default: Date.now
    },
    localTime: String,
    notes: String
});

// Compound index: one filtered record per event + sensor + filter combo
FilteredRecordSchema.index({ eventId: 1, sensor: 1, filterMethod: 1 }, { unique: true });

module.exports = mongoose.model('FilteredRecord', FilteredRecordSchema);
