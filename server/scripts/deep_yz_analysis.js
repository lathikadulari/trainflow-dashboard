/**
 * Deep direction analysis: Fetch raw data from EC2 cloud DB for all 3 confirmed
 * train events, analyze BOTH Y-axis and Z-axis, cross-check local vs remote data,
 * and determine the best algorithm.
 * 
 * Known ground truth:
 *   07:44 AM IST  →  RIGHT → LEFT
 *   08:04 AM IST  →  RIGHT → LEFT
 *   10:01 AM IST  →  LEFT → RIGHT
 */

const { MongoClient } = require('mongodb');

const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';
const LOCAL_URI  = 'mongodb://localhost:27017/trainflow';

// 3 confirmed events (IST → UTC: subtract 5h 30m)
const EVENTS = [
    {
        label: '07:44 AM (R→L)',
        groundTruth: 'right_to_left',
        fromUTC: new Date('2026-06-23T02:13:00.000Z'),
        toUTC:   new Date('2026-06-23T02:26:00.000Z'),
    },
    {
        label: '08:04 AM (R→L)',
        groundTruth: 'right_to_left',
        fromUTC: new Date('2026-06-23T02:33:00.000Z'),
        toUTC:   new Date('2026-06-23T02:40:00.000Z'),
    },
    {
        label: '10:01 AM (L→R)',
        groundTruth: 'left_to_right',
        fromUTC: new Date('2026-06-23T04:30:00.000Z'),
        toUTC:   new Date('2026-06-23T04:35:00.000Z'),
    }
];

// ── Analysis functions ─────────────────────────────────────

function computeBaseline(records, pct = 0.15) {
    const n = Math.max(10, Math.floor(records.length * pct));
    const slice = records.slice(0, n);
    const yVals = slice.map(r => r.payload?.y_g ?? 0);
    const zVals = slice.map(r => r.payload?.z_g ?? 0);
    return {
        yMean: yVals.reduce((s, v) => s + v, 0) / yVals.length,
        zMean: zVals.reduce((s, v) => s + v, 0) / zVals.length,
        yStd: Math.sqrt(yVals.reduce((s, v) => s + (v - yVals.reduce((a, b) => a + b, 0) / yVals.length) ** 2, 0) / yVals.length),
        zStd: Math.sqrt(zVals.reduce((s, v) => s + (v - zVals.reduce((a, b) => a + b, 0) / zVals.length) ** 2, 0) / zVals.length),
    };
}

function findSustainedOnset(records, baseline, threshold, consecutiveNeeded, axis) {
    let consecutive = 0;
    const mean = axis === 'y' ? baseline.yMean : baseline.zMean;
    for (let i = 0; i < records.length; i++) {
        const val = axis === 'y' ? (records[i].payload?.y_g ?? 0) : (records[i].payload?.z_g ?? 0);
        const dev = Math.abs(val - mean);
        if (dev > threshold) {
            consecutive++;
            if (consecutive >= consecutiveNeeded) {
                return {
                    index: i - consecutiveNeeded + 1,
                    time: records[i - consecutiveNeeded + 1].receivedAt,
                    t_us: records[i - consecutiveNeeded + 1].payload?.t_us ?? null,
                    deviation: dev,
                    axis
                };
            }
        } else {
            consecutive = 0;
        }
    }
    return null;
}

function findEitherAxisOnset(records, baseline, threshold, consecutiveNeeded) {
    let consecutiveY = 0, consecutiveZ = 0;
    for (let i = 0; i < records.length; i++) {
        const yVal = records[i].payload?.y_g ?? 0;
        const zVal = records[i].payload?.z_g ?? 0;
        const yDev = Math.abs(yVal - baseline.yMean);
        const zDev = Math.abs(zVal - baseline.zMean);

        if (yDev > threshold) {
            consecutiveY++;
            if (consecutiveY >= consecutiveNeeded) {
                return {
                    index: i - consecutiveNeeded + 1,
                    time: records[i - consecutiveNeeded + 1].receivedAt,
                    t_us: records[i - consecutiveNeeded + 1].payload?.t_us ?? null,
                    axis: 'Y',
                    deviation: yDev
                };
            }
        } else {
            consecutiveY = 0;
        }

        if (zDev > threshold) {
            consecutiveZ++;
            if (consecutiveZ >= consecutiveNeeded) {
                return {
                    index: i - consecutiveNeeded + 1,
                    time: records[i - consecutiveNeeded + 1].receivedAt,
                    t_us: records[i - consecutiveNeeded + 1].payload?.t_us ?? null,
                    axis: 'Z',
                    deviation: zDev
                };
            }
        } else {
            consecutiveZ = 0;
        }
    }
    return null;
}

function computeRollingRMS(records, baseline, windowMs, axis) {
    const mean = axis === 'y' ? baseline.yMean : baseline.zMean;
    const results = [];
    const window = [];

    for (const r of records) {
        const val = axis === 'y' ? (r.payload?.y_g ?? 0) : (r.payload?.z_g ?? 0);
        const time = new Date(r.receivedAt).getTime();
        window.push({ val, time });

        while (window.length > 0 && time - window[0].time > windowMs) {
            window.shift();
        }

        if (window.length >= 3) {
            const rms = Math.sqrt(
                window.reduce((sum, p) => sum + (p.val - mean) ** 2, 0) / window.length
            );
            results.push({ time, rms });
        }
    }
    return results;
}

function findRmsOnset(rmsData, threshold) {
    for (const p of rmsData) {
        if (p.rms > threshold) return p;
    }
    return null;
}

function computeTotalEnergy(records, baseline, axis) {
    const mean = axis === 'y' ? baseline.yMean : baseline.zMean;
    let totalEnergy = 0;
    for (const r of records) {
        const val = axis === 'y' ? (r.payload?.y_g ?? 0) : (r.payload?.z_g ?? 0);
        totalEnergy += (val - mean) ** 2;
    }
    return totalEnergy / records.length;
}

function findPeakTime(records, baseline, axis) {
    const mean = axis === 'y' ? baseline.yMean : baseline.zMean;
    let peakDev = 0, peakTime = null;
    for (const r of records) {
        const val = axis === 'y' ? (r.payload?.y_g ?? 0) : (r.payload?.z_g ?? 0);
        const dev = Math.abs(val - mean);
        if (dev > peakDev) {
            peakDev = dev;
            peakTime = new Date(r.receivedAt).getTime();
        }
    }
    return { peakDev, peakTime };
}

function findLastVibration(records, baseline, threshold, axis) {
    const mean = axis === 'y' ? baseline.yMean : baseline.zMean;
    let lastTime = null;
    for (const r of records) {
        const val = axis === 'y' ? (r.payload?.y_g ?? 0) : (r.payload?.z_g ?? 0);
        if (Math.abs(val - mean) > threshold) {
            lastTime = new Date(r.receivedAt).getTime();
        }
    }
    return lastTime;
}

// ── Combined multi-axis onset detection ────────────────────

function findCombinedOnset(records, baseline, threshold, consecutiveNeeded) {
    // Look at combined magnitude: sqrt(yDev² + zDev²)
    let consecutive = 0;
    for (let i = 0; i < records.length; i++) {
        const yVal = records[i].payload?.y_g ?? 0;
        const zVal = records[i].payload?.z_g ?? 0;
        const yDev = yVal - baseline.yMean;
        const zDev = zVal - baseline.zMean;
        const combinedDev = Math.sqrt(yDev * yDev + zDev * zDev);

        if (combinedDev > threshold) {
            consecutive++;
            if (consecutive >= consecutiveNeeded) {
                return {
                    index: i - consecutiveNeeded + 1,
                    time: records[i - consecutiveNeeded + 1].receivedAt,
                    t_us: records[i - consecutiveNeeded + 1].payload?.t_us ?? null,
                    combinedDev
                };
            }
        } else {
            consecutive = 0;
        }
    }
    return null;
}

// ── Full analysis ──────────────────────────────────────────

function analyzeEvent(label, groundTruth, rightRecords, leftRecords) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`  EVENT: ${label}`);
    console.log(`  Ground Truth: ${groundTruth}`);
    console.log(`  Right (sensor1): ${rightRecords.length} records`);
    console.log(`  Left  (sensor2): ${leftRecords.length} records`);
    console.log(`${'═'.repeat(80)}`);

    const rightBaseline = computeBaseline(rightRecords);
    const leftBaseline = computeBaseline(leftRecords);

    console.log(`\n  Baselines:`);
    console.log(`    Right: Y=${rightBaseline.yMean.toFixed(4)}g (±${rightBaseline.yStd.toFixed(4)}), Z=${rightBaseline.zMean.toFixed(4)}g (±${rightBaseline.zStd.toFixed(4)})`);
    console.log(`    Left:  Y=${leftBaseline.yMean.toFixed(4)}g (±${leftBaseline.yStd.toFixed(4)}), Z=${leftBaseline.zMean.toFixed(4)}g (±${leftBaseline.zStd.toFixed(4)})`);

    const votes = { LEFT: 0, RIGHT: 0 };
    const methods = [];

    const thresholds = [0.08, 0.10, 0.12, 0.15];
    const consecutiveValues = [3, 5];
    const axes = ['y', 'z'];

    // ── Method 1: Per-axis sustained onset at multiple thresholds ──
    console.log(`\n  ── METHOD 1: Sustained Onset (per axis) ──`);
    for (const axis of axes) {
        for (const thresh of thresholds) {
            for (const consec of consecutiveValues) {
                const rightOnset = findSustainedOnset(rightRecords, rightBaseline, thresh, consec, axis);
                const leftOnset = findSustainedOnset(leftRecords, leftBaseline, thresh, consec, axis);

                if (rightOnset && leftOnset) {
                    const rightMs = new Date(rightOnset.time).getTime();
                    const leftMs = new Date(leftOnset.time).getTime();
                    const delta = rightMs - leftMs;
                    const first = delta < 0 ? 'RIGHT' : 'LEFT';
                    const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                    (groundTruth === 'left_to_right' && first === 'LEFT');
                    console.log(`    ${axis.toUpperCase()}-axis | th=${thresh}g | consec=${consec} | ${first} first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
                }
            }
        }
    }

    // ── Method 2: Either-axis onset (Y OR Z whichever triggers first) ──
    console.log(`\n  ── METHOD 2: Either-Axis Onset (Y OR Z first) ──`);
    for (const thresh of thresholds) {
        for (const consec of consecutiveValues) {
            const rightOnset = findEitherAxisOnset(rightRecords, rightBaseline, thresh, consec);
            const leftOnset = findEitherAxisOnset(leftRecords, leftBaseline, thresh, consec);

            if (rightOnset && leftOnset) {
                const rightMs = new Date(rightOnset.time).getTime();
                const leftMs = new Date(leftOnset.time).getTime();
                const delta = rightMs - leftMs;
                const first = delta < 0 ? 'RIGHT' : 'LEFT';
                const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                (groundTruth === 'left_to_right' && first === 'LEFT');
                console.log(`    th=${thresh}g | consec=${consec} | R:${rightOnset.axis}@${new Date(rightOnset.time).toISOString().substr(11,12)} L:${leftOnset.axis}@${new Date(leftOnset.time).toISOString().substr(11,12)} | ${first} first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
            }
        }
    }

    // ── Method 3: Combined magnitude onset ──
    console.log(`\n  ── METHOD 3: Combined Magnitude onset sqrt(yDev² + zDev²) ──`);
    for (const thresh of thresholds) {
        for (const consec of consecutiveValues) {
            const rightOnset = findCombinedOnset(rightRecords, rightBaseline, thresh, consec);
            const leftOnset = findCombinedOnset(leftRecords, leftBaseline, thresh, consec);

            if (rightOnset && leftOnset) {
                const rightMs = new Date(rightOnset.time).getTime();
                const leftMs = new Date(leftOnset.time).getTime();
                const delta = rightMs - leftMs;
                const first = delta < 0 ? 'RIGHT' : 'LEFT';
                const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                (groundTruth === 'left_to_right' && first === 'LEFT');
                console.log(`    th=${thresh}g | consec=${consec} | ${first} first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
            }
        }
    }

    // ── Method 4: Rolling RMS per axis ──
    console.log(`\n  ── METHOD 4: Rolling RMS Onset (500ms window) ──`);
    for (const axis of axes) {
        const rightRms = computeRollingRMS(rightRecords, rightBaseline, 500, axis);
        const leftRms = computeRollingRMS(leftRecords, leftBaseline, 500, axis);

        for (const rmsThresh of [0.03, 0.05, 0.08, 0.10]) {
            const rightOnset = findRmsOnset(rightRms, rmsThresh);
            const leftOnset = findRmsOnset(leftRms, rmsThresh);

            if (rightOnset && leftOnset) {
                const delta = rightOnset.time - leftOnset.time;
                const first = delta < 0 ? 'RIGHT' : 'LEFT';
                const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                (groundTruth === 'left_to_right' && first === 'LEFT');
                console.log(`    ${axis.toUpperCase()}-axis | rms_th=${rmsThresh}g | ${first} first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
            }
        }
    }

    // ── Method 5: Combined RMS (Y+Z energy) ──
    console.log(`\n  ── METHOD 5: Combined RMS (Y+Z energy in window) ──`);
    {
        const rightRmsY = computeRollingRMS(rightRecords, rightBaseline, 500, 'y');
        const rightRmsZ = computeRollingRMS(rightRecords, rightBaseline, 500, 'z');
        const leftRmsY = computeRollingRMS(leftRecords, leftBaseline, 500, 'y');
        const leftRmsZ = computeRollingRMS(leftRecords, leftBaseline, 500, 'z');

        // Combine Y+Z RMS: sqrt(rmsY² + rmsZ²)
        const combineRms = (rmsY, rmsZ) => {
            const combined = [];
            const zMap = new Map(rmsZ.map(p => [p.time, p.rms]));
            for (const p of rmsY) {
                const zRms = zMap.get(p.time) || 0;
                combined.push({ time: p.time, rms: Math.sqrt(p.rms * p.rms + zRms * zRms) });
            }
            return combined;
        };

        const rightCombined = combineRms(rightRmsY, rightRmsZ);
        const leftCombined = combineRms(leftRmsY, leftRmsZ);

        for (const rmsThresh of [0.05, 0.08, 0.10, 0.15]) {
            const rightOnset = findRmsOnset(rightCombined, rmsThresh);
            const leftOnset = findRmsOnset(leftCombined, rmsThresh);

            if (rightOnset && leftOnset) {
                const delta = rightOnset.time - leftOnset.time;
                const first = delta < 0 ? 'RIGHT' : 'LEFT';
                const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                (groundTruth === 'left_to_right' && first === 'LEFT');
                console.log(`    combined_rms_th=${rmsThresh}g | ${first} first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
            }
        }
    }

    // ── Method 6: Per-axis total energy ──
    console.log(`\n  ── METHOD 6: Total Energy Per Axis ──`);
    for (const axis of axes) {
        const eRight = computeTotalEnergy(rightRecords, rightBaseline, axis);
        const eLeft = computeTotalEnergy(leftRecords, leftBaseline, axis);
        const stronger = eRight > eLeft ? 'RIGHT' : 'LEFT';
        const correct = (groundTruth === 'right_to_left' && stronger === 'RIGHT') ||
                        (groundTruth === 'left_to_right' && stronger === 'LEFT');
        console.log(`    ${axis.toUpperCase()}-axis | Right=${eRight.toFixed(6)} | Left=${eLeft.toFixed(6)} | ${stronger} stronger | ${correct ? '✅' : '❌'}`);
    }

    // ── Method 7: Peak timing per axis ──
    console.log(`\n  ── METHOD 7: Peak Timing Per Axis ──`);
    for (const axis of axes) {
        const rightPeak = findPeakTime(rightRecords, rightBaseline, axis);
        const leftPeak = findPeakTime(leftRecords, leftBaseline, axis);
        if (rightPeak.peakTime && leftPeak.peakTime) {
            const delta = rightPeak.peakTime - leftPeak.peakTime;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                            (groundTruth === 'left_to_right' && first === 'LEFT');
            console.log(`    ${axis.toUpperCase()}-axis | ${first} peaked first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
        }
    }

    // ── Method 8: End timing per axis ──
    console.log(`\n  ── METHOD 8: End Timing (calmed first = approached from) ──`);
    for (const axis of axes) {
        const rightEnd = findLastVibration(rightRecords, rightBaseline, 0.2, axis);
        const leftEnd = findLastVibration(leftRecords, leftBaseline, 0.2, axis);
        if (rightEnd && leftEnd) {
            const delta = rightEnd - leftEnd;
            const calmedFirst = delta < 0 ? 'RIGHT' : 'LEFT';
            const correct = (groundTruth === 'right_to_left' && calmedFirst === 'RIGHT') ||
                            (groundTruth === 'left_to_right' && calmedFirst === 'LEFT');
            console.log(`    ${axis.toUpperCase()}-axis | ${calmedFirst} calmed first | Δ=${Math.abs(delta)}ms | ${correct ? '✅' : '❌'}`);
        }
    }

    // ── Method 9: t_us based analysis (most precise) ──
    console.log(`\n  ── METHOD 9: ESP32 t_us Microsecond Timing ──`);
    {
        const rightWithTus = rightRecords.filter(r => r.payload?.t_us && r.payload.t_us > 0);
        const leftWithTus = leftRecords.filter(r => r.payload?.t_us && r.payload.t_us > 0);
        console.log(`    Records with valid t_us: Right=${rightWithTus.length}, Left=${leftWithTus.length}`);

        if (rightWithTus.length > 10 && leftWithTus.length > 10) {
            const rightBaselineTus = computeBaseline(rightWithTus);
            const leftBaselineTus = computeBaseline(leftWithTus);

            for (const thresh of [0.08, 0.10, 0.12]) {
                for (const consec of [3, 5]) {
                    const rightOnset = findEitherAxisOnset(rightWithTus, rightBaselineTus, thresh, consec);
                    const leftOnset = findEitherAxisOnset(leftWithTus, leftBaselineTus, thresh, consec);

                    if (rightOnset && leftOnset && rightOnset.t_us && leftOnset.t_us) {
                        let deltaUs = rightOnset.t_us - leftOnset.t_us;
                        if (deltaUs < -2147483648) deltaUs += 4294967296;
                        if (deltaUs > 2147483648) deltaUs -= 4294967296;
                        const first = deltaUs < 0 ? 'RIGHT' : 'LEFT';
                        const correct = (groundTruth === 'right_to_left' && first === 'RIGHT') ||
                                        (groundTruth === 'left_to_right' && first === 'LEFT');
                        console.log(`    th=${thresh}g | consec=${consec} | ${first} first | Δ=${Math.abs(deltaUs/1000).toFixed(1)}ms (t_us) | ${correct ? '✅' : '❌'}`);
                    }
                }
            }
        } else {
            console.log(`    ⚠️ Not enough t_us data for this event`);
        }
    }

    console.log('');
}

// ── Main ──────────────────────────────────────────────────

async function main() {
    let remoteClient, localClient;

    try {
        console.log('Connecting to EC2 cloud database...');
        remoteClient = new MongoClient(REMOTE_URI, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 60000
        });
        await remoteClient.connect();
        console.log('✅ Connected to EC2 MongoDB');

        localClient = new MongoClient(LOCAL_URI, {
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000
        });
        await localClient.connect();
        console.log('✅ Connected to local MongoDB');

        const remoteDb = remoteClient.db('trainflow');
        const localDb = localClient.db('trainflow');

        for (const event of EVENTS) {
            console.log(`\n\n📡 Fetching data for ${event.label} from EC2...`);

            // Fetch from EC2 (source of truth)
            const remoteRecords = await remoteDb.collection('mqttrecords').find({
                station: 'makumbura',
                sensorId: { $in: ['sensor1', 'sensor2'] },
                receivedAt: { $gte: event.fromUTC, $lte: event.toUTC }
            }).sort({ receivedAt: 1 }).toArray();

            // Also fetch from local for comparison
            const localRecords = await localDb.collection('mqttrecords').find({
                station: 'makumbura',
                sensorId: { $in: ['sensor1', 'sensor2'] },
                receivedAt: { $gte: event.fromUTC, $lte: event.toUTC }
            }).sort({ receivedAt: 1 }).toArray();

            console.log(`  EC2:   ${remoteRecords.length} records`);
            console.log(`  Local: ${localRecords.length} records`);
            console.log(`  Match: ${remoteRecords.length === localRecords.length ? '✅' : '⚠️ DIFFERENT COUNT'}`);

            // Use EC2 data (source of truth)
            const rightRecords = remoteRecords.filter(r => r.sensorId === 'sensor1');
            const leftRecords = remoteRecords.filter(r => r.sensorId === 'sensor2');

            if (rightRecords.length > 0 && leftRecords.length > 0) {
                analyzeEvent(event.label, event.groundTruth, rightRecords, leftRecords);
            } else {
                console.log(`  ⚠️ Missing sensor data for this event`);
            }
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        if (remoteClient) await remoteClient.close();
        if (localClient) await localClient.close();
    }
}

main();
