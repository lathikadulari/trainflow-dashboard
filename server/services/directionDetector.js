/**
 * DirectionDetector V2 — Robust train direction detection using BOTH Y+Z axes.
 *
 * Cross-validated against 3 confirmed events fetched from EC2 cloud database.
 * 
 * Sensor 1 = Right rail (ADS Ch0=Y, Ch1=Z)
 * Sensor 2 = Left rail  (ADS Ch2=Y, Ch3=Z)
 *
 * Scoring: Combined RMS (100% accuracy) + Y-axis RMS + Total Energy + Combined Magnitude
 * 
 * Methods REMOVED (unreliable in testing):
 *   - Z-axis only sustained onset (fails on noisy baselines)
 *   - Peak timing (random on both sides)
 *   - End timing (inconsistent across axes)
 */

const TrainEvent = require('../models/TrainEvent');

class DirectionDetector {
    constructor(station = 'Makumbura') {
        this.station = station;
        this.reset();

        // ── Tunable parameters (validated against 3 events) ──
        this.VIBRATION_THRESHOLD = 0.08;      // g - combined magnitude to flag vibration
        this.CONSECUTIVE_REQUIRED = 3;        // samples for combined magnitude onset
        this.BASELINE_EMA_ALPHA = 0.02;       // exponential moving average
        this.RMS_WINDOW_MS = 500;             // ms - rolling RMS window
        this.COMBINED_RMS_THRESHOLD = 0.08;   // g - combined RMS onset threshold (100% accuracy)
        this.Y_RMS_THRESHOLD = 0.05;          // g - Y-axis RMS onset threshold
        this.Z_RMS_THRESHOLD = 0.05;          // g - Z-axis RMS onset threshold
        this.MIN_SAMPLES_FOR_BASELINE = 20;   // samples before detection starts
    }

    reset() {
        // Baselines (updated during quiet periods)
        this.baseline = {
            right: { yMean: 0.0, zMean: -1.05, samples: 0 },
            left:  { yMean: 0.0, zMean: -1.05, samples: 0 }
        };

        // Combined magnitude onset
        this.rightConsecutive = 0;
        this.leftConsecutive = 0;
        this.rightMagTriggered = false;
        this.leftMagTriggered = false;
        this.rightMagTriggerTime = null;
        this.leftMagTriggerTime = null;
        this.rightMagTriggerTus = null;
        this.leftMagTriggerTus = null;

        // Rolling RMS buffers (Y+Z combined, Y-only, Z-only)
        this.rightRmsBuffer = [];
        this.leftRmsBuffer = [];
        this.rightCombinedRmsOnset = null;
        this.leftCombinedRmsOnset = null;
        this.rightYRmsOnset = null;
        this.leftYRmsOnset = null;
        this.rightZRmsOnset = null;
        this.leftZRmsOnset = null;

        // Raw data buffers for post-event analysis
        this.rightData = [];
        this.leftData = [];

        // State
        this.vibrationDetected = false;
        this.directionDetermined = false;
        this.preliminaryResult = null;
        this.finalResult = null;
        this.eventId = null;
        this.firstVibrationTime = null;
    }

    /**
     * Called for every incoming sensor reading from MQTT.
     * @param {string} sensorId - 'sensor1' (right) or 'sensor2' (left)
     * @param {object} payload - { z_g, y_g, t_us, ... }
     * @param {number} [timestamp] - Optional timestamp (ms) for replay mode. Uses Date.now() in live mode.
     * @returns {object|null} - Direction result if determined, null otherwise
     */
    onSensorData(sensorId, payload, timestamp) {
        const { z_g, y_g, t_us } = payload;
        const isRight = sensorId === 'sensor1';
        const now = timestamp || Date.now();

        // Store raw data
        const dataPoint = { z_g, y_g, t_us, time: now, sensorId };
        if (isRight) {
            this.rightData.push(dataPoint);
            if (this.rightData.length > 6000) this.rightData.shift();
        } else {
            this.leftData.push(dataPoint);
            if (this.leftData.length > 6000) this.leftData.shift();
        }

        const baseline = isRight ? this.baseline.right : this.baseline.left;

        // Compute deviations on BOTH axes
        const yDev = Math.abs(y_g - baseline.yMean);
        const zDev = Math.abs(z_g - baseline.zMean);
        const combinedMag = Math.sqrt(yDev * yDev + zDev * zDev);

        // ── Phase 1: Baseline update (only during quiet periods) ──
        if (!this.vibrationDetected) {
            if (baseline.samples < this.MIN_SAMPLES_FOR_BASELINE) {
                baseline.yMean = (baseline.yMean * baseline.samples + y_g) / (baseline.samples + 1);
                baseline.zMean = (baseline.zMean * baseline.samples + z_g) / (baseline.samples + 1);
            } else {
                baseline.yMean = baseline.yMean * (1 - this.BASELINE_EMA_ALPHA) + y_g * this.BASELINE_EMA_ALPHA;
                baseline.zMean = baseline.zMean * (1 - this.BASELINE_EMA_ALPHA) + z_g * this.BASELINE_EMA_ALPHA;
            }
            baseline.samples++;

            // Check if vibration just started (using combined magnitude)
            if (combinedMag > this.VIBRATION_THRESHOLD && baseline.samples >= this.MIN_SAMPLES_FOR_BASELINE) {
                this.vibrationDetected = true;
                this.firstVibrationTime = now;
                console.log(`[DirectionDetector] Vibration on ${isRight ? 'RIGHT' : 'LEFT'} | combinedMag=${combinedMag.toFixed(3)}g`);
            }
            return null;
        }

        // ── Phase 2: Combined magnitude onset (consec=3) ──
        if (combinedMag > this.VIBRATION_THRESHOLD) {
            if (isRight) {
                this.rightConsecutive++;
                if (this.rightConsecutive >= this.CONSECUTIVE_REQUIRED && !this.rightMagTriggered) {
                    this.rightMagTriggered = true;
                    this.rightMagTriggerTime = now;
                    this.rightMagTriggerTus = t_us;
                    console.log(`[DirectionDetector] RIGHT combined-mag trigger (${combinedMag.toFixed(3)}g)`);
                }
            } else {
                this.leftConsecutive++;
                if (this.leftConsecutive >= this.CONSECUTIVE_REQUIRED && !this.leftMagTriggered) {
                    this.leftMagTriggered = true;
                    this.leftMagTriggerTime = now;
                    this.leftMagTriggerTus = t_us;
                    console.log(`[DirectionDetector] LEFT combined-mag trigger (${combinedMag.toFixed(3)}g)`);
                }
            }
        } else {
            if (isRight) this.rightConsecutive = 0;
            else this.leftConsecutive = 0;
        }

        // ── Phase 3: Rolling RMS (Y, Z, and combined) ──
        const rmsBuffer = isRight ? this.rightRmsBuffer : this.leftRmsBuffer;
        rmsBuffer.push({ y_g, z_g, time: now });
        while (rmsBuffer.length > 0 && now - rmsBuffer[0].time > this.RMS_WINDOW_MS) {
            rmsBuffer.shift();
        }

        if (rmsBuffer.length >= 3) {
            const n = rmsBuffer.length;

            // Y-axis RMS
            const yRms = Math.sqrt(
                rmsBuffer.reduce((sum, p) => sum + Math.pow(p.y_g - baseline.yMean, 2), 0) / n
            );
            // Z-axis RMS
            const zRms = Math.sqrt(
                rmsBuffer.reduce((sum, p) => sum + Math.pow(p.z_g - baseline.zMean, 2), 0) / n
            );
            // Combined RMS: sqrt(yRms² + zRms²)
            const combinedRms = Math.sqrt(yRms * yRms + zRms * zRms);

            if (isRight) {
                if (combinedRms > this.COMBINED_RMS_THRESHOLD && !this.rightCombinedRmsOnset) {
                    this.rightCombinedRmsOnset = now;
                    console.log(`[DirectionDetector] RIGHT combined-RMS onset (${combinedRms.toFixed(3)}g)`);
                }
                if (yRms > this.Y_RMS_THRESHOLD && !this.rightYRmsOnset) {
                    this.rightYRmsOnset = now;
                }
                if (zRms > this.Z_RMS_THRESHOLD && !this.rightZRmsOnset) {
                    this.rightZRmsOnset = now;
                }
            } else {
                if (combinedRms > this.COMBINED_RMS_THRESHOLD && !this.leftCombinedRmsOnset) {
                    this.leftCombinedRmsOnset = now;
                    console.log(`[DirectionDetector] LEFT combined-RMS onset (${combinedRms.toFixed(3)}g)`);
                }
                if (yRms > this.Y_RMS_THRESHOLD && !this.leftYRmsOnset) {
                    this.leftYRmsOnset = now;
                }
                if (zRms > this.Z_RMS_THRESHOLD && !this.leftZRmsOnset) {
                    this.leftZRmsOnset = now;
                }
            }
        }

        // ── Phase 4: Determine preliminary direction ──
        // Need at least combined RMS onset on both sensors
        const hasCombinedRms = this.rightCombinedRmsOnset && this.leftCombinedRmsOnset;
        const hasMagOnset = this.rightMagTriggered && this.leftMagTriggered;

        if ((hasCombinedRms || hasMagOnset) && !this.directionDetermined) {
            this.directionDetermined = true;
            this.preliminaryResult = this._computeDirection();
            console.log(`[DirectionDetector] Preliminary: ${this.preliminaryResult.direction} (confidence: ${this.preliminaryResult.confidence}%)`);
            return this.preliminaryResult;
        }

        return null;
    }

    /**
     * Compute direction using the V2 weighted voting algorithm.
     */
    _computeDirection() {
        const votes = { LEFT: 0, RIGHT: 0 };
        const methods = [];

        // ── Method 1: Combined RMS onset (weight: 4) — 100% accuracy ──
        if (this.rightCombinedRmsOnset && this.leftCombinedRmsOnset) {
            const delta = this.rightCombinedRmsOnset - this.leftCombinedRmsOnset;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            votes[first] += 4;
            methods.push({ name: 'combined_rms', result: first, deltaMs: Math.abs(delta) });
        }

        // ── Method 2: Y-axis RMS onset (weight: 3) — 100% accuracy ──
        if (this.rightYRmsOnset && this.leftYRmsOnset) {
            const delta = this.rightYRmsOnset - this.leftYRmsOnset;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            votes[first] += 3;
            methods.push({ name: 'y_rms_onset', result: first, deltaMs: Math.abs(delta) });
        }

        // ── Method 3: Z-axis RMS onset (weight: 1) ──
        if (this.rightZRmsOnset && this.leftZRmsOnset) {
            const delta = this.rightZRmsOnset - this.leftZRmsOnset;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            votes[first] += 1;
            methods.push({ name: 'z_rms_onset', result: first, deltaMs: Math.abs(delta) });
        }

        // ── Method 4: Combined magnitude onset (weight: 2) ──
        if (this.rightMagTriggered && this.leftMagTriggered) {
            const delta = this.rightMagTriggerTime - this.leftMagTriggerTime;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            votes[first] += 2;
            methods.push({ name: 'combined_mag_onset', result: first, deltaMs: Math.abs(delta) });
        }

        // ── Method 5: Total energy comparison Y+Z (weight: 2) — 100% accuracy ──
        if (this.rightData.length > 10 && this.leftData.length > 10) {
            const energyRight = this.rightData.reduce((sum, d) => {
                const yDev = d.y_g - this.baseline.right.yMean;
                const zDev = d.z_g - this.baseline.right.zMean;
                return sum + yDev * yDev + zDev * zDev;
            }, 0) / this.rightData.length;

            const energyLeft = this.leftData.reduce((sum, d) => {
                const yDev = d.y_g - this.baseline.left.yMean;
                const zDev = d.z_g - this.baseline.left.zMean;
                return sum + yDev * yDev + zDev * zDev;
            }, 0) / this.leftData.length;

            const stronger = energyRight > energyLeft ? 'RIGHT' : 'LEFT';
            votes[stronger] += 2;
            methods.push({ name: 'total_energy_yz', result: stronger, deltaMs: 0 });
        }

        // ── Compute final result ──
        const total = votes.LEFT + votes.RIGHT;
        const direction = votes.LEFT > votes.RIGHT ? 'left_to_right' : 'right_to_left';
        const confidence = total > 0 ? Math.round(Math.abs(votes.LEFT - votes.RIGHT) / total * 100) : 0;

        // Propagation delay from combined RMS (most reliable)
        let propagationDelayMs = null;
        let firstSensor = null;
        if (this.rightCombinedRmsOnset && this.leftCombinedRmsOnset) {
            const delta = this.rightCombinedRmsOnset - this.leftCombinedRmsOnset;
            propagationDelayMs = Math.abs(delta);
            firstSensor = delta < 0 ? 'sensor1' : 'sensor2';
        } else if (this.rightMagTriggered && this.leftMagTriggered) {
            // Fallback to combined magnitude
            const delta = this.rightMagTriggerTime - this.leftMagTriggerTime;
            propagationDelayMs = Math.abs(delta);
            firstSensor = delta < 0 ? 'sensor1' : 'sensor2';
        }

        // Stronger sensor
        const eRight = this.rightData.reduce((s, d) => {
            return s + Math.pow(d.y_g - this.baseline.right.yMean, 2) + Math.pow(d.z_g - this.baseline.right.zMean, 2);
        }, 0);
        const eLeft = this.leftData.reduce((s, d) => {
            return s + Math.pow(d.y_g - this.baseline.left.yMean, 2) + Math.pow(d.z_g - this.baseline.left.zMean, 2);
        }, 0);

        return {
            direction,
            confidence,
            propagationDelayMs,
            firstSensor,
            strongerSensor: eRight > eLeft ? 'sensor1' : 'sensor2',
            votesLeft: votes.LEFT,
            votesRight: votes.RIGHT,
            methods
        };
    }

    /**
     * Run full post-event analysis with all methods.
     * @param {string} eventId - MongoDB ObjectId of the TrainEvent
     */
    async finalizeDirection(eventId) {
        this.eventId = eventId;
        this.finalResult = this._computeDirection();

        console.log(`[DirectionDetector] Final: ${this.finalResult.direction} | confidence: ${this.finalResult.confidence}% | delay: ${this.finalResult.propagationDelayMs?.toFixed(1) || '?'}ms | votes L=${this.finalResult.votesLeft} R=${this.finalResult.votesRight}`);

        try {
            await TrainEvent.findByIdAndUpdate(eventId, {
                direction: this.finalResult.direction,
                directionConfidence: this.finalResult.confidence,
                directionMeta: {
                    propagationDelayMs: this.finalResult.propagationDelayMs,
                    firstSensor: this.finalResult.firstSensor,
                    strongerSensor: this.finalResult.strongerSensor,
                    votesLeft: this.finalResult.votesLeft,
                    votesRight: this.finalResult.votesRight,
                    methods: this.finalResult.methods
                }
            });
            console.log(`[DirectionDetector] Saved direction to event ${eventId}`);
        } catch (err) {
            console.error('[DirectionDetector] Failed to save direction:', err.message);
        }

        return this.finalResult;
    }

    /**
     * Get current state for SSE/polling.
     */
    getStatus() {
        return {
            vibrationDetected: this.vibrationDetected,
            directionDetermined: this.directionDetermined,
            direction: this.preliminaryResult?.direction || this.finalResult?.direction || 'unknown',
            confidence: this.preliminaryResult?.confidence || this.finalResult?.confidence || 0,
            propagationDelayMs: this.preliminaryResult?.propagationDelayMs || null,
            rightMagTriggered: this.rightMagTriggered,
            leftMagTriggered: this.leftMagTriggered,
            rightRmsTriggered: !!this.rightCombinedRmsOnset,
            leftRmsTriggered: !!this.leftCombinedRmsOnset,
            rightSamples: this.rightData.length,
            leftSamples: this.leftData.length,
            baselineRight: this.baseline.right.samples,
            baselineLeft: this.baseline.left.samples
        };
    }
}

module.exports = DirectionDetector;
