const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const CSV_PATH = path.join(__dirname, '..', '..', 'docs', 'makumbura_sd_train_spike_dataset.csv');

// ── Sri Lankan Time (IST UTC+5:30) helper ───────────────────
function toIST(date) {
    const d = date || new Date();
    return d.toLocaleString('en-GB', {
        timeZone: 'Asia/Colombo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }) + '.' + String(d.getMilliseconds()).padStart(3, '0') + ' IST';
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found at: ${CSV_PATH}`);
        process.exit(1);
    }

    console.log('Reading CSV data...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = csvContent.split('\n');
    console.log(`Loaded ${lines.length} lines.`);

    const client = new MongoClient(LOCAL_URI);
    try {
        await client.connect();
        console.log('✅ Connected to MongoDB');
        const db = client.db('trainflow');

        // Let's set the event to happen today (so it shows up in the default view range)
        // e.g., today at 10:00 AM UTC (which is 3:30 PM IST)
        const eventStartTime = new Date();
        eventStartTime.setUTCHours(10, 0, 0, 0); 
        console.log(`Setting event start time to: ${eventStartTime.toISOString()} (${toIST(eventStartTime)})`);

        const mqttrecords = [];
        const batchSize = 2000;

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const parts = line.split(',');
            if (parts.length < 13) continue;

            const sampleIndex = parseInt(parts[0], 10);
            
            // Sensor 1 data
            const s1_x_g = parseFloat(parts[1]);
            const s1_y_g = parseFloat(parts[2]);
            const s1_z_g = parseFloat(parts[3]);
            const s1_x_v = parseFloat(parts[4]);
            const s1_y_v = parseFloat(parts[5]);
            const s1_z_v = parseFloat(parts[6]);

            // Sensor 2 data
            const s2_x_g = parseFloat(parts[7]);
            const s2_y_g = parseFloat(parts[8]);
            const s2_z_g = parseFloat(parts[9]);
            const s2_x_v = parseFloat(parts[10]);
            const s2_y_v = parseFloat(parts[11]);
            const s2_z_v = parseFloat(parts[12]);

            // Time for this sample (10 Hz = 100 ms interval)
            const sampleTime = new Date(eventStartTime.getTime() + (sampleIndex * 100));
            const t_us = sampleIndex * 100000; // microseconds

            // Sensor 1 MqttRecord
            mqttrecords.push({
                topic: 'makumbura/sensor1',
                payload: {
                    x_g: s1_x_g,
                    y_g: s1_y_g,
                    z_g: s1_z_g,
                    x_v: s1_x_v,
                    y_v: s1_y_v,
                    z_v: s1_z_v,
                    t_us: t_us
                },
                rawPayload: JSON.stringify({
                    x_g: s1_x_g,
                    y_g: s1_y_g,
                    z_g: s1_z_g,
                    x_v: s1_x_v,
                    y_v: s1_y_v,
                    z_v: s1_z_v,
                    t_us: t_us
                }),
                station: 'makumbura',
                sensorId: 'sensor1',
                receivedAt: sampleTime,
                localTime: toIST(sampleTime)
            });

            // Sensor 2 MqttRecord
            mqttrecords.push({
                topic: 'makumbura/sensor2',
                payload: {
                    x_g: s2_x_g,
                    y_g: s2_y_g,
                    z_g: s2_z_g,
                    x_v: s2_x_v,
                    y_v: s2_y_v,
                    z_v: s2_z_v,
                    t_us: t_us
                },
                rawPayload: JSON.stringify({
                    x_g: s2_x_g,
                    y_g: s2_y_g,
                    z_g: s2_z_g,
                    x_v: s2_x_v,
                    y_v: s2_y_v,
                    z_v: s2_z_v,
                    t_us: t_us
                }),
                station: 'makumbura',
                sensorId: 'sensor2',
                receivedAt: sampleTime,
                localTime: toIST(sampleTime)
            });
        }

        console.log(`Parsed ${mqttrecords.length} records. Clear old records...`);
        await db.collection('mqttrecords').deleteMany({ station: 'makumbura' });
        await db.collection('trainevents').deleteMany({ station: 'Makumbura' });

        console.log('Inserting records in batches...');
        for (let i = 0; i < mqttrecords.length; i += batchSize) {
            const batch = mqttrecords.slice(i, i + batchSize);
            await db.collection('mqttrecords').insertMany(batch);
            console.log(`Inserted ${i + batch.length}/${mqttrecords.length} records.`);
        }

        // Create the TrainEvent
        const totalSamples = lines.length - 2; // Subtract header and final newline/empty line
        const eventEndTime = new Date(eventStartTime.getTime() + (totalSamples * 100));
        const duration = eventEndTime.getTime() - eventStartTime.getTime();

        const trainEvent = {
            station: 'Makumbura',
            type: 'stopped',
            startTime: eventStartTime,
            startTimeIST: toIST(eventStartTime),
            endTime: eventEndTime,
            endTimeIST: toIST(eventEndTime),
            duration: duration,
            notes: 'Imported from local SD spike dataset',
            active: false,
            direction: 'left_to_right',
            directionConfidence: 95,
            directionMeta: {
                propagationDelayMs: 400,
                firstSensor: 'sensor2',
                strongerSensor: 'sensor1',
                votesLeft: 12,
                votesRight: 0,
                methods: [
                    { name: 'Threshold Trigger', result: 'LEFT', deltaMs: 400 },
                    { name: 'Cross-Correlation', result: 'LEFT', deltaMs: 380 }
                ]
            }
        };

        const eventResult = await db.collection('trainevents').insertOne(trainEvent);
        console.log(`✅ Created TrainEvent in local database: ${eventResult.insertedId}`);
        console.log(`   Start: ${toIST(eventStartTime)}`);
        console.log(`   End:   ${toIST(eventEndTime)}`);
        console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);

    } catch (err) {
        console.error('❌ Error during import:', err);
    } finally {
        await client.close();
        console.log('Database connection closed.');
    }
}

main();
