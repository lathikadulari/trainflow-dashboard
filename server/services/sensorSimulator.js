/**
 * ADXL335 Accelerometer Sensor Simulator
 * Realistic train vibration matching research paper patterns
 * Reference: Burst patterns with frequency peaks at 50-150 Hz
 */

const EventEmitter = require('events');

class SensorSimulator extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.intervalId = null;
        this.dataBuffer = { sensorA: [], sensorB: [] };
        this.fftBuffer = { sensorA: { x: [], y: [], z: [] }, sensorB: { x: [], y: [], z: [] } };
        this.maxBufferSize = 512;
        this.fftWindowSize = 256;

        // ADXL335 Specifications
        this.adxl335 = {
            vcc: 3.3,           // Supply voltage
            zeroG: 1.65,        // Zero-g output voltage (Vcc/2)
            sensitivity: 0.33,  // 330mV/g typical sensitivity
            maxG: 3.0,          // ±3g range
            minVoltage: 0.0,
            maxVoltage: 3.3,
        };

        this.config = {
            sampleRate: 500, // Higher sample rate for better frequency resolution
            sensorDistance: 100,

            // Signal parameters (matching research paper scale)
            baselineNoise: 500, // Low noise baseline
            maxAmplitude: 60000, // Peak amplitude during train pass

            // Timing
            trainApproachDuration: 8000,
            trainPassDuration: 4000,
            trainDepartDuration: 6000,
        };

        this.trainState = {
            isApproaching: false,
            direction: null,
            speed: 0,
            currentPhase: 'idle',
            phaseStartTime: 0,
            sensorATriggerTime: null,
            sensorBTriggerTime: null,
        };

        this.detectionThreshold = 5000;
        this.timeCounter = 0;
    }

    gaussianRandom(mean = 0, stdev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        return z0 * stdev + mean;
    }

    // Convert raw accelerometer value to ADXL335 analog voltage output (0-3.3V)
    rawToVoltage(rawValue) {
        // Normalize raw value (-60000 to +60000) to g-force (-3g to +3g)
        const gForce = rawValue / (this.config.maxAmplitude / this.adxl335.maxG);
        // Convert g-force to voltage: V = 1.65V + (g * 0.33V/g)
        const voltage = this.adxl335.zeroG + (gForce * this.adxl335.sensitivity);
        // Clamp to 0-3.3V range
        return Math.max(this.adxl335.minVoltage, Math.min(this.adxl335.maxVoltage, voltage));
    }

    // DSP PIC FFT Simulation - Computes FFT for a given signal array
    computeFFT(signal, sampleRate = 500) {
        const N = signal.length;
        if (N < 16) return [];

        // Pad to power of 2
        const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
        const padded = [...signal];
        while (padded.length < paddedLength) padded.push(0);

        const results = [];

        // DFT computation (simulating DSP PIC processing)
        for (let k = 0; k < paddedLength / 2; k++) {
            let realSum = 0, imagSum = 0;

            for (let n = 0; n < paddedLength; n++) {
                const angle = (2 * Math.PI * k * n) / paddedLength;
                realSum += padded[n] * Math.cos(angle);
                imagSum -= padded[n] * Math.sin(angle);
            }

            const magnitude = Math.sqrt(realSum * realSum + imagSum * imagSum) / paddedLength;
            const frequency = (k * sampleRate) / paddedLength;

            // Filter to 10-500 Hz range (relevant for train vibration)
            if (frequency >= 10 && frequency <= 500) {
                results.push({ frequency: Math.round(frequency), magnitude });
            }
        }

        return results;
    }

    // Compute FFT for all axes of both sensors
    // Only compute FFT when signal is above noise threshold (like a real DSP system)
    computeAllFFT() {
        const { sensorA, sensorB } = this.dataBuffer;
        if (sensorA.length < this.fftWindowSize) return null;

        // Check if there's a significant signal in the FFT window using MAX (not average)
        const windowA = sensorA.slice(-this.fftWindowSize);
        const windowB = sensorB.slice(-this.fftWindowSize);
        const maxMagnitudeA = Math.max(...windowA.map(d => Math.abs(d.magnitude || 0)));
        const maxMagnitudeB = Math.max(...windowB.map(d => Math.abs(d.magnitude || 0)));

        // Signal threshold - show FFT if ANY sample in window exceeds baseline noise
        const signalThreshold = 1500; // Lowered to catch signal earlier

        const extractAxis = (data, axis) => data.slice(-this.fftWindowSize).map(d => d[axis]);

        // Return empty for sensors with no significant signal
        const computeIfSignificant = (data, maxMag) => {
            if (maxMag < signalThreshold) {
                return { x: [], y: [], z: [] }; // No significant signal - return empty
            }
            return {
                x: this.computeFFT(extractAxis(data, 'x'), this.config.sampleRate),
                y: this.computeFFT(extractAxis(data, 'y'), this.config.sampleRate),
                z: this.computeFFT(extractAxis(data, 'z'), this.config.sampleRate),
            };
        };

        return {
            sensorA: computeIfSignificant(sensorA, maxMagnitudeA),
            sensorB: computeIfSignificant(sensorB, maxMagnitudeB),
        };
    }

    // Generate baseline noise (no train)
    generateBaseline() {
        const noise = this.config.baselineNoise;
        return {
            x: this.gaussianRandom(0, noise * 0.3),
            y: this.gaussianRandom(0, noise * 0.3),
            z: this.gaussianRandom(0, noise * 0.2),
        };
    }

    // Generate train vibration burst pattern (matching Figure 4e)
    generateTrainBurst(intensity, sensorDelay = 0) {
        const t = (this.timeCounter - sensorDelay) / 1000;

        if (t < 0) return this.generateBaseline();

        const amp = this.config.maxAmplitude * intensity;

        // Multiple frequency components (matching Figure 5 - train FFT peaks)
        // Primary: 50-80 Hz, Secondary: 100-150 Hz
        const f1 = 60 + Math.random() * 20;  // 60-80 Hz main component
        const f2 = 120 + Math.random() * 30; // 120-150 Hz secondary
        const f3 = 40 + Math.random() * 10;  // 40-50 Hz low component

        // Burst modulation (creates the characteristic train pattern)
        const burstFreq = 8 + Math.random() * 4; // Wheel/axle passing frequency
        const burstEnvelope = 0.5 + 0.5 * Math.sin(2 * Math.PI * burstFreq * t);

        // Random amplitude modulation for realism
        const randomMod = 0.7 + Math.random() * 0.6;

        // Combined signal
        const signal1 = Math.sin(2 * Math.PI * f1 * t) * 0.5;
        const signal2 = Math.sin(2 * Math.PI * f2 * t) * 0.3;
        const signal3 = Math.sin(2 * Math.PI * f3 * t) * 0.2;

        const combined = (signal1 + signal2 + signal3) * burstEnvelope * randomMod;

        // Add noise
        const noise = this.gaussianRandom(0, 0.1);

        return {
            x: (combined + noise) * amp * 0.8,
            y: (combined * 0.7 + this.gaussianRandom(0, 0.08)) * amp * 0.6,
            z: (Math.abs(combined) + noise * 0.5) * amp,
        };
    }

    calculateIntensity(sensor) {
        const now = Date.now();
        const elapsed = now - this.trainState.phaseStartTime;
        const state = this.trainState;

        if (state.currentPhase === 'idle') {
            return { intensity: 0, delay: 0 };
        }

        const isSensorFirst = (sensor === 'A' && state.direction === 'right-to-left') ||
            (sensor === 'B' && state.direction === 'left-to-right');

        const delayMs = isSensorFirst ? 0 : (this.config.sensorDistance / state.speed) * 1000 * 3.6;

        let intensity = 0;

        if (state.currentPhase === 'approaching') {
            const progress = Math.min(1, elapsed / this.config.trainApproachDuration);
            // Sharp increase near the end (matching burst pattern)
            intensity = Math.pow(progress, 3) * 0.7;
        } else if (state.currentPhase === 'passing') {
            // Full intensity with variations
            intensity = 0.8 + Math.random() * 0.2;
        } else if (state.currentPhase === 'departing') {
            const progress = Math.min(1, elapsed / this.config.trainDepartDuration);
            // Faster decay
            intensity = (1 - Math.pow(progress, 0.5)) * 0.9;
        }

        return { intensity, delay: delayMs };
    }

    generateSensorData() {
        const timestamp = Date.now();
        this.timeCounter += 1000 / this.config.sampleRate;

        const calcA = this.calculateIntensity('A');
        const calcB = this.calculateIntensity('B');

        let dataA, dataB;

        if (calcA.intensity > 0.01) {
            dataA = this.generateTrainBurst(calcA.intensity, calcA.delay);
        } else {
            dataA = this.generateBaseline();
        }

        if (calcB.intensity > 0.01) {
            dataB = this.generateTrainBurst(calcB.intensity, calcB.delay);
        } else {
            dataB = this.generateBaseline();
        }

        const magnitudeA = Math.sqrt(dataA.x ** 2 + dataA.y ** 2 + dataA.z ** 2);
        const magnitudeB = Math.sqrt(dataB.x ** 2 + dataB.y ** 2 + dataB.z ** 2);

        if (magnitudeA > 5000 && !this.trainState.sensorATriggerTime) {
            this.trainState.sensorATriggerTime = timestamp;
            this.emit('sensorTriggered', { sensor: 'A', timestamp });
        }
        if (magnitudeB > 5000 && !this.trainState.sensorBTriggerTime) {
            this.trainState.sensorBTriggerTime = timestamp;
            this.emit('sensorTriggered', { sensor: 'B', timestamp });
        }

        const result = {
            timestamp,
            sensorA: {
                ...dataA,
                magnitude: magnitudeA,
                voltage: {
                    x: this.rawToVoltage(dataA.x),
                    y: this.rawToVoltage(dataA.y),
                    z: this.rawToVoltage(dataA.z),
                }
            },
            sensorB: {
                ...dataB,
                magnitude: magnitudeB,
                voltage: {
                    x: this.rawToVoltage(dataB.x),
                    y: this.rawToVoltage(dataB.y),
                    z: this.rawToVoltage(dataB.z),
                }
            },
            trainState: {
                phase: this.trainState.currentPhase,
                direction: this.trainState.direction,
                speed: this.trainState.speed,
                isApproaching: this.trainState.isApproaching,
            }
        };

        this.dataBuffer.sensorA.push({ timestamp, ...dataA, magnitude: magnitudeA });
        this.dataBuffer.sensorB.push({ timestamp, ...dataB, magnitude: magnitudeB });

        if (this.dataBuffer.sensorA.length > this.maxBufferSize) {
            this.dataBuffer.sensorA.shift();
            this.dataBuffer.sensorB.shift();
        }

        return result;
    }

    triggerTrain(direction = null, speed = null) {
        if (this.trainState.currentPhase !== 'idle') return false;

        this.trainState.direction = direction || (Math.random() > 0.5 ? 'left-to-right' : 'right-to-left');
        this.trainState.speed = speed || (60 + Math.random() * 60);
        this.trainState.currentPhase = 'approaching';
        this.trainState.phaseStartTime = Date.now();
        this.trainState.isApproaching = true;
        this.trainState.sensorATriggerTime = null;
        this.trainState.sensorBTriggerTime = null;
        this.timeCounter = 0;

        this.emit('trainApproaching', { direction: this.trainState.direction, speed: this.trainState.speed });

        setTimeout(() => {
            if (this.trainState.currentPhase === 'approaching') {
                this.trainState.currentPhase = 'passing';
                this.trainState.phaseStartTime = Date.now();
                this.emit('trainPassing', { direction: this.trainState.direction, speed: this.trainState.speed });
            }
        }, this.config.trainApproachDuration);

        setTimeout(() => {
            if (this.trainState.currentPhase === 'passing') {
                this.trainState.currentPhase = 'departing';
                this.trainState.phaseStartTime = Date.now();
            }
        }, this.config.trainApproachDuration + this.config.trainPassDuration);

        setTimeout(() => {
            if (this.trainState.currentPhase === 'departing') {
                const detectedSpeed = this.calculateDetectedSpeed();
                this.emit('trainPassed', {
                    direction: this.trainState.direction,
                    actualSpeed: this.trainState.speed,
                    detectedSpeed
                });
                this.resetTrainState();
            }
        }, this.config.trainApproachDuration + this.config.trainPassDuration + this.config.trainDepartDuration);

        return true;
    }

    calculateDetectedSpeed() {
        if (this.trainState.sensorATriggerTime && this.trainState.sensorBTriggerTime) {
            const timeDiff = Math.abs(this.trainState.sensorBTriggerTime - this.trainState.sensorATriggerTime) / 1000;
            if (timeDiff > 0) return (this.config.sensorDistance / timeDiff) * 3.6;
        }
        return null;
    }

    resetTrainState() {
        this.trainState = {
            isApproaching: false,
            direction: null,
            speed: 0,
            currentPhase: 'idle',
            phaseStartTime: 0,
            sensorATriggerTime: null,
            sensorBTriggerTime: null,
        };
        this.timeCounter = 0;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        // Send data at 50Hz for display (downsample from 500Hz internal)
        let counter = 0;
        this.intervalId = setInterval(() => {
            const data = this.generateSensorData();
            counter++;
            if (counter % 10 === 0) { // Every 10th sample = 50Hz
                this.emit('data', data);
            }
        }, 1000 / this.config.sampleRate);

        this.scheduleRandomTrain();
        this.emit('started');
        console.log('Sensor simulation started (research-matched mode)');
    }

    scheduleRandomTrain() {
        if (!this.isRunning) return;
        const delay = 20000 + Math.random() * 40000;
        this.trainTimeout = setTimeout(() => {
            if (this.isRunning) {
                this.triggerTrain();
                this.scheduleRandomTrain();
            }
        }, delay);
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.trainTimeout) clearTimeout(this.trainTimeout);
        this.resetTrainState();
        this.emit('stopped');
        console.log('Sensor simulation stopped');
    }

    getBuffer() { return this.dataBuffer; }
    getStatus() {
        return {
            isRunning: this.isRunning,
            trainState: this.trainState,
            config: this.config,
            bufferSize: this.dataBuffer.sensorA.length
        };
    }
}

module.exports = new SensorSimulator();
