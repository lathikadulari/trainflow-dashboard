/**
 * Sync train events and mqttrecords for the specific timeframe from local to remote MongoDB
 * Timeframe: 2026-06-23 15:05:46.387 IST to 15:08:42.000 IST
 */
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';

// Convert IST to UTC (subtract 5 hours 30 minutes)
const FROM_UTC = new Date('2026-06-23T09:35:46.387Z');
const TO_UTC   = new Date('2026-06-23T09:38:42.000Z');

async function main() {
    console.log('=== DATABASE TIMEFRAME SYNC ===');
    console.log(`Timeframe (IST): 2026-06-23 15:05:46.387 to 15:08:42.000`);
    console.log(`Timeframe (UTC): ${FROM_UTC.toISOString()} to ${TO_UTC.toISOString()}`);
    console.log('--------------------------------\n');

    const localClient = new MongoClient(LOCAL_URI);
    const remoteClient = new MongoClient(REMOTE_URI);

    try {
        // ── 1. Connect to both databases ──────────────────
        console.log('Connecting to Local MongoDB...');
        await localClient.connect();
        console.log('✅ Connected to Local');

        console.log('Connecting to Remote MongoDB...');
        await remoteClient.connect();
        console.log('✅ Connected to Remote\n');

        const localDb = localClient.db('trainflow');
        const remoteDb = remoteClient.db('trainflow');

        // ── 2. Fetch local data ───────────────────────────
        console.log('Fetching local train events in timeframe...');
        const localEvents = await localDb.collection('trainevents').find({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        }).toArray();
        console.log(`Found ${localEvents.length} local train events.`);

        console.log('Fetching local mqttrecords in timeframe...');
        const localRecords = await localDb.collection('mqttrecords').find({
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        }).toArray();
        console.log(`Found ${localRecords.length} local mqttrecords.\n`);

        if (localEvents.length === 0 && localRecords.length === 0) {
            console.log('⚠️ No local data found in this timeframe. Aborting sync.');
            return;
        }

        // ── 3. Check remote data before deletion ─────────
        const preRemoteEventsCount = await remoteDb.collection('trainevents').countDocuments({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        const preRemoteRecordsCount = await remoteDb.collection('mqttrecords').countDocuments({
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`Pre-sync remote counts: ${preRemoteEventsCount} events, ${preRemoteRecordsCount} records.`);

        // ── 4. Delete existing remote data in timeframe ──
        console.log('\nDeleting existing remote train events in timeframe...');
        const delEventsRes = await remoteDb.collection('trainevents').deleteMany({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`Deleted ${delEventsRes.deletedCount} remote events.`);

        console.log('Deleting existing remote mqttrecords in timeframe...');
        const delRecordsRes = await remoteDb.collection('mqttrecords').deleteMany({
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`Deleted ${delRecordsRes.deletedCount} remote records.`);

        // ── 5. Insert local data into remote ──────────────
        if (localEvents.length > 0) {
            console.log('\nInserting local train events into Remote...');
            const insEventsRes = await remoteDb.collection('trainevents').insertMany(localEvents);
            console.log(`✅ Successfully inserted ${insEventsRes.insertedCount} train events into Remote.`);
        }

        if (localRecords.length > 0) {
            console.log('Inserting local mqttrecords into Remote...');
            const insRecordsRes = await remoteDb.collection('mqttrecords').insertMany(localRecords);
            console.log(`✅ Successfully inserted ${insRecordsRes.insertedCount} mqttrecords into Remote.`);
        }

        // ── 6. Final verification count ──────────────────
        console.log('\n--- VERIFICATION ---');
        const postRemoteEventsCount = await remoteDb.collection('trainevents').countDocuments({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        const postRemoteRecordsCount = await remoteDb.collection('mqttrecords').countDocuments({
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`Post-sync remote counts: ${postRemoteEventsCount} events, ${postRemoteRecordsCount} records.`);
        console.log(`Local counts:             ${localEvents.length} events, ${localRecords.length} records.`);

        if (postRemoteEventsCount === localEvents.length && postRemoteRecordsCount === localRecords.length) {
            console.log('\n🎉 SUCCESS: Cloud database has been successfully updated and verified!');
        } else {
            console.log('\n⚠️ WARNING: Count mismatch detected after sync!');
        }

    } catch (err) {
        console.error('\n❌ Error during synchronization:', err.message);
    } finally {
        await localClient.close();
        await remoteClient.close();
    }
}

main();
