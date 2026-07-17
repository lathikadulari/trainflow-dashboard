/**
 * Analyze train direction by comparing which sensor detected vibration first.
 * Sensor 1 = Right rail sensor
 * Sensor 2 = Left rail sensor
 * 
 * If Right detects first → train approaching from Right to Left
 * If Left detects first → train approaching from Left to Right
 */
const { MongoClient, ObjectId } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const FROM_UTC = new Date('2026-06-23T02:14:00.000Z');
const TO_UTC   = new Date('2026-06-23T02:25:00.000Z');
const BUFFER_BEFORE = 30; // seconds
const BUFFER_AFTER = 30;

const SENSOR_FROM = new Date(FROM_UTC.getTime() - BUFFER_BEFORE * 1000);
const SENSOR_TO   = new Date(TO_UTC.getTime() + BUFFER_AFTER * 1000);

async function main() {
    const client = new MongoClient(LOCAL_URI);
    await client.connect();
    const db = client.db('trainflow');

    // Fetch all sensor records
    const records = await db.collection('mqttrecords').find({
        station: 'makumbura',
        sensorId: { $in: ['sensor1', 'sensor2'] },
        receivedAt: { $gte: SENSOR_FROM, $lte: SENSOR_TO }
    }).sort({ receivedAt: 1 }).toArray();

    const sensor1 = records.filter(r => r.sensorId === 'sensor1');
    const sensor2 = records.filter(r => r.sensorId === 'sensor2');

    console.log(`Total records: ${records.length}`);
    console.log(`Sensor 1 (Right): ${sensor1.length} records`);
    console.log(`Sensor 2 (Left): ${sensor2.length} records`);

    // ── Compute baseline (first 3 seconds of data) ──────
    const computeBaseline = (sensorRecords, durationMs = 3000) => {
        const startTime = new Date(sensorRecords[0].receivedAt).getTime();
        const baselineRecords = sensorRecords.filter(r => 
            new Date(r.receivedAt).getTime() - startTime < durationMs
        );
        
        const zValues = baselineRecords.map(r => r.payload?.z_g ?? 0);
        const yValues = baselineRecords.map(r => r.payload?.y_g ?? 0);
        
        const zMean = zValues.reduce((a, b) => a + b, 0) / zValues.length;
        const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;
        
        const zStd = Math.sqrt(zValues.reduce((sum, v) => sum + (v - zMean) ** 2, 0) / zValues.length);
        const yStd = Math.sqrt(yValues.reduce((sum, v) => sum + (v - yMean) ** 2, 0) / yValues.length);
        
        return { zMean, yMean, zStd, yStd, count: baselineRecords.length };
    };

    const baseline1 = computeBaseline(sensor1);
    const baseline2 = computeBaseline(sensor2);

    console.log(`\n=== Baselines (first 3s) ===`);
    console.log(`Sensor 1 (Right): z_mean=${baseline1.zMean.toFixed(4)}, z_std=${baseline1.zStd.toFixed(4)}, y_mean=${baseline1.yMean.toFixed(4)}, y_std=${baseline1.yStd.toFixed(4)} (${baseline1.count} samples)`);
    console.log(`Sensor 2 (Left):  z_mean=${baseline2.zMean.toFixed(4)}, z_std=${baseline2.zStd.toFixed(4)}, y_mean=${baseline2.yMean.toFixed(4)}, y_std=${baseline2.yStd.toFixed(4)} (${baseline2.count} samples)`);

    // ── Find first vibration trigger ──────────────────
    // A "trigger" = when z_g deviates more than 4x the baseline std from the baseline mean
    const THRESHOLD_MULTIPLIER = 4;

    const findFirstTrigger = (sensorRecords, baseline, label) => {
        const threshold = Math.max(baseline.zStd * THRESHOLD_MULTIPLIER, 0.15); // minimum threshold of 0.15g
        
        // Skip the baseline period (first 3s)
        const startTime = new Date(sensorRecords[0].receivedAt).getTime();
        
        for (const record of sensorRecords) {
            const t = new Date(record.receivedAt).getTime();
            if (t - startTime < 3000) continue; // skip baseline period
            
            const zg = record.payload?.z_g ?? 0;
            const deviation = Math.abs(zg - baseline.zMean);
            
            if (deviation > threshold) {
                return {
                    time: record.receivedAt,
                    tUs: record.payload?.t_us,
                    zg,
                    deviation,
                    threshold,
                    localTime: record.localTime
                };
            }
        }
        return null;
    };

    const trigger1 = findFirstTrigger(sensor1, baseline1, 'Right');
    const trigger2 = findFirstTrigger(sensor2, baseline2, 'Left');

    console.log(`\n=== First Vibration Trigger ===`);
    console.log(`Threshold: ${THRESHOLD_MULTIPLIER}x baseline std (min 0.15g)`);
    
    if (trigger1) {
        console.log(`Sensor 1 (Right): ${trigger1.localTime || trigger1.time} | z_g=${trigger1.zg.toFixed(4)} | deviation=${trigger1.deviation.toFixed(4)} > threshold=${trigger1.threshold.toFixed(4)} | t_us=${trigger1.tUs}`);
    } else {
        console.log(`Sensor 1 (Right): No trigger found`);
    }
    
    if (trigger2) {
        console.log(`Sensor 2 (Left):  ${trigger2.localTime || trigger2.time} | z_g=${trigger2.zg.toFixed(4)} | deviation=${trigger2.deviation.toFixed(4)} > threshold=${trigger2.threshold.toFixed(4)} | t_us=${trigger2.tUs}`);
    } else {
        console.log(`Sensor 2 (Left): No trigger found`);
    }

    // ── Determine direction using t_us (microsecond precision) ──
    if (trigger1 && trigger2) {
        // Use t_us for microsecond-level comparison
        if (trigger1.tUs && trigger2.tUs) {
            let deltaUs = trigger1.tUs - trigger2.tUs;
            // Handle 32-bit wrap
            if (deltaUs < -2147483648) deltaUs += 4294967296;
            if (deltaUs > 2147483648) deltaUs -= 4294967296;
            
            const deltaMs = deltaUs / 1000;
            const deltaSec = deltaMs / 1000;
            
            console.log(`\n=== Direction Analysis (using t_us microsecond clock) ===`);
            console.log(`Time difference: ${deltaMs.toFixed(2)} ms (${deltaSec.toFixed(3)} seconds)`);
            
            if (deltaUs < 0) {
                console.log(`\n🚆 RIGHT sensor triggered FIRST (by ${Math.abs(deltaMs).toFixed(2)} ms)`);
                console.log(`→ Train direction: RIGHT → LEFT`);
                console.log(`  (Train approached from the Right sensor side)`);
            } else if (deltaUs > 0) {
                console.log(`\n🚆 LEFT sensor triggered FIRST (by ${Math.abs(deltaMs).toFixed(2)} ms)`);
                console.log(`→ Train direction: LEFT → RIGHT`);
                console.log(`  (Train approached from the Left sensor side)`);
            } else {
                console.log(`\n🚆 Both sensors triggered simultaneously — cannot determine direction`);
            }
        } else {
            // Fallback to receivedAt
            const t1 = new Date(trigger1.time).getTime();
            const t2 = new Date(trigger2.time).getTime();
            const deltaMs = t1 - t2;
            
            console.log(`\n=== Direction Analysis (using receivedAt - less precise) ===`);
            console.log(`Time difference: ${deltaMs} ms`);
            
            if (deltaMs < 0) {
                console.log(`🚆 RIGHT sensor triggered FIRST → Train direction: RIGHT → LEFT`);
            } else if (deltaMs > 0) {
                console.log(`🚆 LEFT sensor triggered FIRST → Train direction: LEFT → RIGHT`);
            }
        }
    }

    // ── Peak vibration analysis ──────────────────
    console.log(`\n=== Peak Vibration Analysis ===`);
    
    const findPeak = (sensorRecords) => {
        let maxZ = -Infinity, maxZRecord = null;
        let minZ = Infinity, minZRecord = null;
        for (const r of sensorRecords) {
            const zg = r.payload?.z_g ?? 0;
            if (zg > maxZ) { maxZ = zg; maxZRecord = r; }
            if (zg < minZ) { minZ = zg; minZRecord = r; }
        }
        return { maxZ, maxZRecord, minZ, minZRecord, range: maxZ - minZ };
    };

    const peak1 = findPeak(sensor1);
    const peak2 = findPeak(sensor2);

    console.log(`Sensor 1 (Right): z_range=${peak1.range.toFixed(4)}g (min=${peak1.minZ.toFixed(4)}, max=${peak1.maxZ.toFixed(4)})`);
    console.log(`Sensor 2 (Left):  z_range=${peak2.range.toFixed(4)}g (min=${peak2.minZ.toFixed(4)}, max=${peak2.maxZ.toFixed(4)})`);
    
    if (peak1.range > peak2.range) {
        console.log(`→ Right sensor had stronger vibration (${((peak1.range / peak2.range - 1) * 100).toFixed(1)}% more)`);
    } else {
        console.log(`→ Left sensor had stronger vibration (${((peak2.range / peak1.range - 1) * 100).toFixed(1)}% more)`);
    }

    await client.close();
}

main().catch(console.error);
