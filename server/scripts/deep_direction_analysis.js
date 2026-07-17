/**
 * Deep analysis of train direction for the ~10:01 AM IST event.
 * The user confirms this train is LEFT → RIGHT.
 * Let's analyze WHY and find better direction indicators.
 */
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

async function main() {
    const client = new MongoClient(LOCAL_URI);
    await client.connect();
    const db = client.db('trainflow');

    // Find the event around 10:01 AM IST (04:31 UTC)
    // IST 10:01 = UTC 04:31
    const searchFrom = new Date('2026-06-23T04:25:00.000Z');
    const searchTo = new Date('2026-06-23T04:40:00.000Z');

    const events = await db.collection('trainevents').find({
        startTime: { $gte: searchFrom, $lte: searchTo }
    }).sort({ startTime: 1 }).toArray();

    console.log(`Found ${events.length} events around 10:01 AM IST:`);
    events.forEach((e, i) => {
        console.log(`  ${i+1}. type=${e.type}, start=${e.startTimeIST}, end=${e.endTimeIST}, duration=${e.duration}ms`);
    });

    if (events.length === 0) {
        console.log('No events found. Let me search wider...');
        const allEvents = await db.collection('trainevents').find({}).sort({ startTime: -1 }).limit(10).toArray();
        console.log('\nLast 10 events:');
        allEvents.forEach((e, i) => {
            console.log(`  ${i+1}. start=${e.startTimeIST || e.startTime}, end=${e.endTimeIST || e.endTime}, type=${e.type}, duration=${e.duration}ms`);
        });
    }

    // Get the event - use the first one found or search more broadly
    const event = events[0];
    if (!event) {
        await client.close();
        return;
    }

    const bufferBefore = 30; // seconds
    const bufferAfter = 30;
    const windowStart = new Date(event.startTime.getTime() - bufferBefore * 1000);
    const windowEnd = new Date((event.endTime || event.startTime).getTime() + bufferAfter * 1000);

    console.log(`\nAnalyzing event: ${event.startTimeIST} to ${event.endTimeIST}`);
    console.log(`Window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Fetch all sensor records
    const records = await db.collection('mqttrecords').find({
        station: 'makumbura',
        sensorId: { $in: ['sensor1', 'sensor2'] },
        receivedAt: { $gte: windowStart, $lte: windowEnd }
    }).sort({ receivedAt: 1 }).toArray();

    const sensor1 = records.filter(r => r.sensorId === 'sensor1'); // Right
    const sensor2 = records.filter(r => r.sensorId === 'sensor2'); // Left

    console.log(`\nSensor 1 (Right): ${sensor1.length} records`);
    console.log(`Sensor 2 (Left): ${sensor2.length} records`);

    // ── Common anchor for t_us reconstruction ──────────
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

    // ── Compute baseline from first 2 seconds ──────────
    const computeBaseline = (sensorRecords) => {
        const startMs = reconstructTime(sensorRecords[0]);
        const baseRecords = sensorRecords.filter(r => reconstructTime(r) - startMs < 2000);
        const zVals = baseRecords.map(r => r.payload?.z_g ?? 0);
        const yVals = baseRecords.map(r => r.payload?.y_g ?? 0);
        const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        const std = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
        const zM = mean(zVals), yM = mean(yVals);
        return { zMean: zM, yMean: yM, zStd: std(zVals, zM), yStd: std(yVals, yM), count: baseRecords.length };
    };

    const base1 = computeBaseline(sensor1);
    const base2 = computeBaseline(sensor2);

    console.log(`\n=== Baselines ===`);
    console.log(`Right: z_mean=${base1.zMean.toFixed(4)}, z_std=${base1.zStd.toFixed(4)}`);
    console.log(`Left:  z_mean=${base2.zMean.toFixed(4)}, z_std=${base2.zStd.toFixed(4)}`);

    // ── Analysis 1: First trigger at multiple thresholds ──────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ANALYSIS 1: First Trigger at Multiple Thresholds ===`);
    console.log(`${'='.repeat(60)}`);

    const thresholds = [0.10, 0.15, 0.20, 0.30, 0.50, 0.75, 1.0];
    for (const thresh of thresholds) {
        const findTrigger = (sensorRecords, baseline) => {
            const startMs = reconstructTime(sensorRecords[0]);
            for (const r of sensorRecords) {
                const t = reconstructTime(r);
                if (t - startMs < 2000) continue;
                const zDev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
                const yDev = Math.abs((r.payload?.y_g ?? 0) - baseline.yMean);
                if (zDev > thresh || yDev > thresh) {
                    return { timeMs: t, axis: zDev > thresh ? 'Z' : 'Y', deviation: Math.max(zDev, yDev) };
                }
            }
            return null;
        };

        const t1 = findTrigger(sensor1, base1);
        const t2 = findTrigger(sensor2, base2);

        if (t1 && t2) {
            const delta = t1.timeMs - t2.timeMs;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            console.log(`  Threshold ${thresh.toFixed(2)}g: ${first} first by ${Math.abs(delta).toFixed(1)}ms  (R: ${t1.axis}-axis, L: ${t2.axis}-axis)`);
        }
    }

    // ── Analysis 2: Rolling RMS energy in 500ms windows ──────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ANALYSIS 2: Rolling RMS Energy (500ms windows) ===`);
    console.log(`${'='.repeat(60)}`);

    const computeRollingRMS = (sensorRecords, baseline, windowMs = 500) => {
        const results = [];
        const startMs = reconstructTime(sensorRecords[0]);
        
        for (let windowStart = 0; windowStart < 30000; windowStart += windowMs) {
            const windowRecords = sensorRecords.filter(r => {
                const t = reconstructTime(r) - startMs;
                return t >= windowStart && t < windowStart + windowMs;
            });
            
            if (windowRecords.length < 3) continue;
            
            const zRms = Math.sqrt(
                windowRecords.reduce((sum, r) => {
                    const dev = (r.payload?.z_g ?? 0) - baseline.zMean;
                    return sum + dev * dev;
                }, 0) / windowRecords.length
            );
            
            results.push({ windowStart, zRms, count: windowRecords.length });
        }
        return results;
    };

    const rms1 = computeRollingRMS(sensor1, base1);
    const rms2 = computeRollingRMS(sensor2, base2);

    // Find when each sensor's RMS exceeds thresholds
    const rmsThresholds = [0.2, 0.3, 0.5];
    for (const rmsThresh of rmsThresholds) {
        const first1 = rms1.find(r => r.zRms > rmsThresh);
        const first2 = rms2.find(r => r.zRms > rmsThresh);
        if (first1 && first2) {
            const delta = first1.windowStart - first2.windowStart;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            console.log(`  RMS > ${rmsThresh}g: ${first} first by ${Math.abs(delta)}ms  (R@${first1.windowStart}ms rms=${first1.zRms.toFixed(3)}, L@${first2.windowStart}ms rms=${first2.zRms.toFixed(3)})`);
        }
    }

    // ── Analysis 3: Peak vibration timing ──────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ANALYSIS 3: Peak Vibration Timing ===`);
    console.log(`${'='.repeat(60)}`);

    const findPeakTime = (sensorRecords, baseline) => {
        let maxDev = 0, peakRecord = null;
        for (const r of sensorRecords) {
            const dev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
            if (dev > maxDev) {
                maxDev = dev;
                peakRecord = r;
            }
        }
        return { timeMs: reconstructTime(peakRecord), maxDev, localTime: peakRecord?.localTime };
    };

    const peak1 = findPeakTime(sensor1, base1);
    const peak2 = findPeakTime(sensor2, base2);
    const peakDelta = peak1.timeMs - peak2.timeMs;

    console.log(`  Right peak: ${peak1.localTime} | max_dev=${peak1.maxDev.toFixed(4)}g`);
    console.log(`  Left peak:  ${peak2.localTime} | max_dev=${peak2.maxDev.toFixed(4)}g`);
    console.log(`  Delta: ${peakDelta.toFixed(1)}ms → ${peakDelta < 0 ? 'RIGHT' : 'LEFT'} peaked first`);

    // ── Analysis 4: Vibration END timing (which sensor calms down first) ──
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ANALYSIS 4: Vibration END Timing (which calms first) ===`);
    console.log(`${'='.repeat(60)}`);
    console.log(`(The sensor the train PASSES first should calm down first)`);

    const findLastTrigger = (sensorRecords, baseline, thresh = 0.3) => {
        let lastRecord = null;
        const startMs = reconstructTime(sensorRecords[0]);
        for (const r of sensorRecords) {
            const t = reconstructTime(r) - startMs;
            if (t < 2000) continue;
            const zDev = Math.abs((r.payload?.z_g ?? 0) - baseline.zMean);
            if (zDev > thresh) lastRecord = r;
        }
        if (!lastRecord) return null;
        return { timeMs: reconstructTime(lastRecord), localTime: lastRecord?.localTime };
    };

    const endThresholds = [0.2, 0.3, 0.5];
    for (const thresh of endThresholds) {
        const end1 = findLastTrigger(sensor1, base1, thresh);
        const end2 = findLastTrigger(sensor2, base2, thresh);
        if (end1 && end2) {
            const delta = end1.timeMs - end2.timeMs;
            const first = delta < 0 ? 'RIGHT' : 'LEFT';
            console.log(`  Last exceedance > ${thresh}g: ${first} calmed first by ${Math.abs(delta).toFixed(1)}ms`);
        }
    }

    // ── Analysis 5: Sustained energy comparison (onset vs offset) ──
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ANALYSIS 5: Energy Build-up vs Fade-out Pattern ===`);
    console.log(`${'='.repeat(60)}`);
    console.log(`For LEFT→RIGHT train:`);
    console.log(`  - LEFT sensor should: build up FIRST, have STRONGER vibration`);
    console.log(`  - RIGHT sensor should: build up LATER, calm down LATER`);
    console.log(`  - LEFT should calm first (train has passed it)`);

    // Compare energy in 2-second windows across the event
    console.log(`\n  Time Window  |  Right RMS  |  Left RMS   |  Stronger`);
    console.log(`  -------------|-------------|-------------|----------`);
    const startMs = reconstructTime(allSorted[0]);
    for (let t = 0; t < 25000; t += 2000) {
        const windowRecs1 = sensor1.filter(r => {
            const rt = reconstructTime(r) - startMs;
            return rt >= t && rt < t + 2000;
        });
        const windowRecs2 = sensor2.filter(r => {
            const rt = reconstructTime(r) - startMs;
            return rt >= t && rt < t + 2000;
        });

        const rms = (recs, baseline) => {
            if (recs.length === 0) return 0;
            return Math.sqrt(recs.reduce((s, r) => {
                const d = (r.payload?.z_g ?? 0) - baseline.zMean;
                return s + d * d;
            }, 0) / recs.length);
        };

        const r1 = rms(windowRecs1, base1);
        const r2 = rms(windowRecs2, base2);
        const stronger = r1 > r2 ? 'RIGHT' : 'LEFT';
        const marker = (r1 > 0.2 || r2 > 0.2) ? ' ◀' : '';
        console.log(`  ${(t/1000).toFixed(0).padStart(3)}s - ${((t+2000)/1000).toFixed(0).padStart(3)}s  |   ${r1.toFixed(4)}    |   ${r2.toFixed(4)}    |  ${stronger}${marker}`);
    }

    // ── Final Summary ──────────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== SUMMARY ===`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Z Right range: ${(sensor1.reduce((max, r) => Math.max(max, r.payload?.z_g ?? 0), -Infinity) - sensor1.reduce((min, r) => Math.min(min, r.payload?.z_g ?? 0), Infinity)).toFixed(4)}g`);
    console.log(`Z Left range:  ${(sensor2.reduce((max, r) => Math.max(max, r.payload?.z_g ?? 0), -Infinity) - sensor2.reduce((min, r) => Math.min(min, r.payload?.z_g ?? 0), Infinity)).toFixed(4)}g`);
    console.log(`\nStronger sensor: ${peak2.maxDev > peak1.maxDev ? 'LEFT' : 'RIGHT'} (${Math.max(peak1.maxDev, peak2.maxDev).toFixed(4)}g vs ${Math.min(peak1.maxDev, peak2.maxDev).toFixed(4)}g)`);

    await client.close();
}

main().catch(console.error);
