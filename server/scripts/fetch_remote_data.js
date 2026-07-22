/**
 * Fetch sensor data from remote EC2 MongoDB and create a train event in local DB.
 * 
 * Usage: node fetch_remote_data.js
 * 
 * Time range: ~7:44 AM to ~7:55 AM IST on June 23, 2026
 * IST = UTC + 5:30
 *   7:44 AM IST = 02:14 AM UTC
 *   7:55 AM IST = 02:25 AM UTC
 */

const { MongoClient } = require('mongodb');

// ── Configuration ──────────────────────────────────────
const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';
const LOCAL_URI  = 'mongodb://localhost:27017/trainflow';

// Time range in IST: 7:44 AM - 7:55 AM on June 23, 2026
// Convert to UTC: subtract 5h 30m
const FROM_UTC = new Date('2026-06-23T02:14:00.000Z');
const TO_UTC   = new Date('2026-06-23T02:25:00.000Z');

// Add buffer for sensor data (30s before and after)
const SENSOR_FROM = new Date(FROM_UTC.getTime() - 30 * 1000);
const SENSOR_TO   = new Date(TO_UTC.getTime() + 30 * 1000);

const STATION = 'makumbura';

async function main() {
    let remoteClient, localClient;

    try {
        // ── Step 1: Connect to remote MongoDB ──────────────
        console.log('Connecting to remote MongoDB at 13.235.248.117...');
        remoteClient = new MongoClient(REMOTE_URI, {
            connectTimeoutMS: 10000,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 30000
        });
        await remoteClient.connect();
        console.log('✅ Connected to remote MongoDB');

        const remoteDb = remoteClient.db('trainflow');

        // ── Step 2: Fetch train events in this time range ──
        console.log(`\nSearching for train events between 7:44 AM and 7:55 AM IST...`);
        const remoteEvents = await remoteDb.collection('trainevents').find({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        }).sort({ startTime: -1 }).toArray();

        console.log(`Found ${remoteEvents.length} train events in remote DB`);
        remoteEvents.forEach((e, i) => {
            console.log(`  Event ${i + 1}: type=${e.type}, start=${e.startTimeIST || e.startTime}, duration=${e.duration}ms, active=${e.active}`);
        });

        // ── Step 3: Fetch sensor records in this time range ──
        console.log(`\nFetching sensor records from ${SENSOR_FROM.toISOString()} to ${SENSOR_TO.toISOString()}...`);
        const sensorRecords = await remoteDb.collection('mqttrecords').find({
            station: STATION,
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: SENSOR_FROM, $lte: SENSOR_TO }
        }).sort({ receivedAt: 1 }).toArray();

        console.log(`Found ${sensorRecords.length} sensor records`);

        const sensor1Count = sensorRecords.filter(r => r.sensorId === 'sensor1').length;
        const sensor2Count = sensorRecords.filter(r => r.sensorId === 'sensor2').length;
        console.log(`  Sensor 1 (Right): ${sensor1Count} records`);
        console.log(`  Sensor 2 (Left): ${sensor2Count} records`);

        // Also fetch status records
        const statusRecords = await remoteDb.collection('mqttrecords').find({
            station: STATION,
            sensorId: 'status',
            receivedAt: { $gte: SENSOR_FROM, $lte: SENSOR_TO }
        }).sort({ receivedAt: 1 }).toArray();
        console.log(`  Status records: ${statusRecords.length}`);

        if (sensorRecords.length === 0 && remoteEvents.length === 0) {
            console.log('\n⚠️  No data found in this time range on the remote server.');
            console.log('The remote server may not have been recording during this time.');
            return;
        }

        // ── Step 4: Connect to local MongoDB ──────────────
        console.log('\nConnecting to local MongoDB...');
        localClient = new MongoClient(LOCAL_URI, {
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000
        });
        await localClient.connect();
        console.log('✅ Connected to local MongoDB');

        const localDb = localClient.db('trainflow');

        // ── Step 5: Insert train events into local DB ──────
        if (remoteEvents.length > 0) {
            console.log('\nInserting train events into local DB...');
            for (const event of remoteEvents) {
                // Check if already exists
                const existing = await localDb.collection('trainevents').findOne({ _id: event._id });
                if (existing) {
                    console.log(`  ⏭️  Event ${event._id} already exists locally, skipping`);
                } else {
                    await localDb.collection('trainevents').insertOne(event);
                    console.log(`  ✅ Inserted event: type=${event.type}, start=${event.startTimeIST || event.startTime}`);
                }
            }
        }

        // ── Step 6: Insert sensor records into local DB ────
        const allRecords = [...sensorRecords, ...statusRecords];
        if (allRecords.length > 0) {
            console.log(`\nInserting ${allRecords.length} sensor records into local DB...`);
            let inserted = 0, skipped = 0;

            // Batch insert — skip duplicates
            for (const record of allRecords) {
                try {
                    const existing = await localDb.collection('mqttrecords').findOne({ _id: record._id });
                    if (existing) {
                        skipped++;
                    } else {
                        await localDb.collection('mqttrecords').insertOne(record);
                        inserted++;
                    }
                } catch (err) {
                    if (err.code === 11000) { // Duplicate key
                        skipped++;
                    } else {
                        throw err;
                    }
                }
            }
            console.log(`  ✅ Inserted: ${inserted}, Skipped (duplicates): ${skipped}`);
        }

        // ── Step 7: If no train event found but sensor data exists, create one ──
        if (remoteEvents.length === 0 && sensorRecords.length > 0) {
            console.log('\n📝 No train event found in remote DB for this time, creating one manually...');
            
            const newEvent = {
                station: 'Makumbura',
                type: 'approaching',
                startTime: FROM_UTC,
                startTimeIST: '23/06/2026, 07:44:00.000 IST',
                endTime: TO_UTC,
                endTimeIST: '23/06/2026, 07:55:00.000 IST',
                duration: TO_UTC.getTime() - FROM_UTC.getTime(),
                notes: 'Manually created from remote sensor data',
                active: false
            };

            const result = await localDb.collection('trainevents').insertOne(newEvent);
            console.log(`  ✅ Created train event with ID: ${result.insertedId}`);
            console.log(`  Duration: ${newEvent.duration / 1000}s`);
        }

        console.log('\n🎉 Done! Data has been synced to your local database.');

    } catch (err) {
        if (err.message && err.message.includes('connect')) {
            console.error('\n❌ Connection failed:', err.message);
            console.log('\nPossible reasons:');
            console.log('  1. Remote MongoDB port 27017 is not open in EC2 Security Group');
            console.log('  2. MongoDB on EC2 is only listening on localhost (127.0.0.1)');
            console.log('  3. Network/firewall blocking the connection');
        } else {
            console.error('\n❌ Error:', err.message);
        }
    } finally {
        if (remoteClient) await remoteClient.close();
        if (localClient) await localClient.close();
    }
}

main();
