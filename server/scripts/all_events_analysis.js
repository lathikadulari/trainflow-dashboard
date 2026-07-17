/**
 * Comprehensive analysis of ALL train events to compare direction detection methods.
 * Analyzes each event with multiple techniques to find the most reliable approach.
 */
const { MongoClient } = require('mongodb');
const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

async function analyzeEvent(db, event, label) {
    const bufferBefore = 30, bufferAfter = 30;
    const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
    const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

    const records = await db.collection('mqttrecords').find({
        station: 'makumbura',
        sensorId: { $in: ['sensor1', 'sensor2'] },
        receivedAt: { $gte: windowStart, $lte: windowEnd }
    }).sort({ receivedAt: 1 }).toArray();

    const sensor1 = records.filter(r => r.sensorId === 'sensor1');
    const sensor2 = records.filter(r => r.sensorId === 'sensor2');

    if (sensor1.length === 0 || sensor2.length === 0) return null;

    // Common anchor
    const allSorted = [...records].sort((a, b) =>
        new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime()
    );
    const anchorTime = new Date(allSorted[0].receivedAt).getTime();
    const anchorTus = allSorted[0].payload?.t_us ?? 0;

    const reconstructTime = (record) => {
        const tus = record.payload?.t_us ?? 0;
        if (!tus || !anchorTus) return new Date(record.receivedAt).getTime();
        let deltaUs = tus - anchorTus;
        if (deltaUs < -2147483648) deltaUs += 4294967296;
        if (deltaUs > 2147483648) deltaUs -= 4294967296;
        return anchorTime + (deltaUs / 1000);
    };

    // Baseline (first 2s)
    const computeBaseline = (sensorRecords) => {
        const startMs = reconstructTime(sensorRecords[0]);
        const baseRecords = sensorRecords.filter(r => reconstructTime(r) - startMs < 2000);
        const zVals = baseRecords.map(r => r.payload?.z_g ?? 0);
        const yVals = baseRecords.map(r => r.payload?.y_g ?? 0);
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
        const zM = mean(zVals), yM = mean(yVals);
        return { zMean: zM, yMean: yM, zStd: std(zVals, zM), yStd: std(yVals, yM) };
    };

    const base1 = computeBaseline(sensor1);
    const base2 = computeBaseline(sensor2);

    const results = { label, event, sensorCounts: { right: sensor1.length, left: sensor2.length } };

    // Method 1: First trigger at multiple thresholds
    results.triggers = {};
    for (const thresh of [0.05, 0.10, 0.15, 0.20, 0.30, 0.50]) {
        const findTrigger = (sensorRecords, baseline) => {
            const startMs = reconstructTime(sensorRecords[0]);
            for (const r of sensorRecords) {
                const t = reconstructTime(r);
                if (t - startMs < 2000) continue;
                const zDev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
                const yDev = Math.abs((r.payload?.y_g ?? 0) - baseline.yMean);
                if (zDev > thresh || yDev > thresh) return t;
            }
            return null;
        };
        const t1 = findTrigger(sensor1, base1);
        const t2 = findTrigger(sensor2, base2);
        if (t1 && t2) {
            results.triggers[thresh] = { deltaMs: t1 - t2, first: (t1 - t2) < 0 ? 'RIGHT' : 'LEFT' };
        }
    }

    // Method 2: Rolling RMS onset
    results.rmsOnset = {};
    const computeRMS = (sensorRecords, baseline, windowMs = 500) => {
        const startMs = reconstructTime(sensorRecords[0]);
        const results = [];
        for (let ws = 0; ws < 60000; ws += windowMs) {
            const recs = sensorRecords.filter(r => {
                const t = reconstructTime(r) - startMs;
                return t >= ws && t < ws + windowMs;
            });
            if (recs.length < 2) continue;
            const rms = Math.sqrt(recs.reduce((s, r) => {
                const d = (r.payload?.z_g ?? 0) - baseline.zMean;
                return s + d * d;
            }, 0) / recs.length);
            results.push({ windowStart: ws, rms });
        }
        return results;
    };

    const rms1 = computeRMS(sensor1, base1);
    const rms2 = computeRMS(sensor2, base2);
    for (const rmsThresh of [0.05, 0.10, 0.20]) {
        const first1 = rms1.find(r => r.rms > rmsThresh);
        const first2 = rms2.find(r => r.rms > rmsThresh);
        if (first1 && first2) {
            results.rmsOnset[rmsThresh] = { 
                deltaMs: first1.windowStart - first2.windowStart, 
                first: (first1.windowStart - first2.windowStart) < 0 ? 'RIGHT' : 'LEFT' 
            };
        }
    }

    // Method 3: Peak timing
    const findPeak = (sensorRecords, baseline) => {
        let maxDev = 0, peakTime = 0;
        for (const r of sensorRecords) {
            const dev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
            if (dev > maxDev) { maxDev = dev; peakTime = reconstructTime(r); }
        }
        return { maxDev, peakTime };
    };
    const peak1 = findPeak(sensor1, base1);
    const peak2 = findPeak(sensor2, base2);
    results.peaks = {
        rightMaxDev: peak1.maxDev, leftMaxDev: peak2.maxDev,
        deltaMs: peak1.peakTime - peak2.peakTime,
        first: (peak1.peakTime - peak2.peakTime) < 0 ? 'RIGHT' : 'LEFT',
        strongerSensor: peak1.maxDev > peak2.maxDev ? 'RIGHT' : 'LEFT'
    };

    // Method 4: Vibration end timing
    const findEnd = (sensorRecords, baseline, thresh = 0.20) => {
        let lastTime = 0;
        const startMs = reconstructTime(sensorRecords[0]);
        for (const r of sensorRecords) {
            if (reconstructTime(r) - startMs < 2000) continue;
            const zDev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
            if (zDev > thresh) lastTime = reconstructTime(r);
        }
        return lastTime;
    };
    const end1 = findEnd(sensor1, base1);
    const end2 = findEnd(sensor2, base2);
    results.endTiming = {
        deltaMs: end1 - end2,
        calmedFirst: (end1 - end2) < 0 ? 'RIGHT' : 'LEFT'
    };

    // Method 5: Total energy comparison
    const totalEnergy = (sensorRecords, baseline) => {
        return sensorRecords.reduce((sum, r) => {
            const d = (r.payload?.z_g ?? 0) - baseline.zMean;
            return sum + d * d;
        }, 0) / sensorRecords.length;
    };
    results.totalEnergy = {
        right: totalEnergy(sensor1, base1),
        left: totalEnergy(sensor2, base2),
        strongerSensor: totalEnergy(sensor1, base1) > totalEnergy(sensor2, base2) ? 'RIGHT' : 'LEFT'
    };

    // Method 6: Z-axis range
    const range = (sensorRecords) => {
        let min = Infinity, max = -Infinity;
        for (const r of sensorRecords) {
            const z = r.payload?.z_g ?? 0;
            if (z < min) min = z;
            if (z > max) max = z;
        }
        return max - min;
    };
    results.zRange = { right: range(sensor1), left: range(sensor2) };

    // Method 7: Consecutive samples above threshold (sustained vibration onset)
    const findSustained = (sensorRecords, baseline, thresh = 0.10, minConsecutive = 5) => {
        const startMs = reconstructTime(sensorRecords[0]);
        let consecutive = 0;
        for (const r of sensorRecords) {
            const t = reconstructTime(r);
            if (t - startMs < 2000) continue;
            const zDev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
            if (zDev > thresh) {
                consecutive++;
                if (consecutive >= minConsecutive) return t;
            } else {
                consecutive = 0;
            }
        }
        return null;
    };
    const sus1 = findSustained(sensor1, base1);
    const sus2 = findSustained(sensor2, base2);
    results.sustained = sus1 && sus2 ? {
        deltaMs: sus1 - sus2,
        first: (sus1 - sus2) < 0 ? 'RIGHT' : 'LEFT'
    } : null;

    return results;
}

async function main() {
    const client = new MongoClient(LOCAL_URI);
    await client.connect();
    const db = client.db('trainflow');

    const allEvents = await db.collection('trainevents').find({})
        .sort({ startTime: -1 }).toArray();

    console.log(`Total events in database: ${allEvents.length}\n`);

    for (const event of allEvents) {
        const label = `${event.startTimeIST || event.startTime} | ${event.type} | ${(event.duration/1000).toFixed(0)}s`;
        console.log(`${'═'.repeat(70)}`);
        console.log(`EVENT: ${label}`);
        console.log(`${'═'.repeat(70)}`);

        const r = await analyzeEvent(db, event, label);
        if (!r) { console.log('  No sensor data available\n'); continue; }

        console.log(`Records: Right=${r.sensorCounts.right}, Left=${r.sensorCounts.left}`);

        console.log(`\n  METHOD 1 - First Trigger (threshold → first sensor):`);
        for (const [thresh, data] of Object.entries(r.triggers)) {
            console.log(`    ${thresh}g: ${data.first} first by ${Math.abs(data.deltaMs).toFixed(1)}ms`);
        }

        console.log(`\n  METHOD 2 - Rolling RMS Onset:`);
        for (const [thresh, data] of Object.entries(r.rmsOnset)) {
            console.log(`    RMS>${thresh}g: ${data.first} first by ${Math.abs(data.deltaMs)}ms`);
        }

        console.log(`\n  METHOD 3 - Peak Timing:`);
        console.log(`    Peak first: ${r.peaks.first} (by ${Math.abs(r.peaks.deltaMs).toFixed(1)}ms)`);
        console.log(`    Stronger:   ${r.peaks.strongerSensor} (R=${r.peaks.rightMaxDev.toFixed(3)}g, L=${r.peaks.leftMaxDev.toFixed(3)}g)`);

        console.log(`\n  METHOD 4 - End Timing (which calms first):`);
        console.log(`    Calmed first: ${r.endTiming.calmedFirst} (by ${Math.abs(r.endTiming.deltaMs).toFixed(1)}ms)`);

        console.log(`\n  METHOD 5 - Total Energy:`);
        console.log(`    Stronger: ${r.totalEnergy.strongerSensor} (R=${r.totalEnergy.right.toFixed(6)}, L=${r.totalEnergy.left.toFixed(6)})`);

        console.log(`\n  METHOD 6 - Z Range:`);
        console.log(`    R=${r.zRange.right.toFixed(4)}g, L=${r.zRange.left.toFixed(4)}g → ${r.zRange.left > r.zRange.right ? 'LEFT' : 'RIGHT'} stronger`);

        if (r.sustained) {
            console.log(`\n  METHOD 7 - Sustained Vibration (5+ consecutive samples):`);
            console.log(`    ${r.sustained.first} first by ${Math.abs(r.sustained.deltaMs).toFixed(1)}ms`);
        }

        // Direction vote
        const votes = { LEFT: 0, RIGHT: 0 };
        // Low threshold triggers (most reliable)
        if (r.triggers[0.10]) votes[r.triggers[0.10].first] += 2;
        if (r.triggers[0.15]) votes[r.triggers[0.15].first] += 2;
        if (r.triggers[0.20]) votes[r.triggers[0.20].first] += 1;
        // RMS onset
        if (r.rmsOnset[0.05]) votes[r.rmsOnset[0.05].first] += 2;
        if (r.rmsOnset[0.10]) votes[r.rmsOnset[0.10].first] += 1;
        // Peak timing
        votes[r.peaks.first] += 1;
        // Stronger sensor
        votes[r.peaks.strongerSensor] += 1;
        // End timing (calmed first = train passed that sensor first = approaching FROM that side)
        votes[r.endTiming.calmedFirst] += 1;
        // Sustained
        if (r.sustained) votes[r.sustained.first] += 2;

        const direction = votes.LEFT > votes.RIGHT ? 'LEFT → RIGHT' : 'RIGHT → LEFT';
        const confidence = Math.abs(votes.LEFT - votes.RIGHT) / (votes.LEFT + votes.RIGHT) * 100;

        console.log(`\n  ══════════════════════════════════════════`);
        console.log(`  PREDICTED DIRECTION: 🚆 ${direction}`);
        console.log(`  Votes: LEFT=${votes.LEFT}, RIGHT=${votes.RIGHT} (confidence: ${confidence.toFixed(0)}%)`);
        console.log(`  ══════════════════════════════════════════\n`);
    }

    await client.close();
}

main().catch(console.error);
