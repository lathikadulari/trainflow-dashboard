const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';

// Time frame in IST: 15:05:46.387 to 15:08:42.000 on June 23, 2026
// IST is UTC + 5:30.
// 15:05:46.387 IST = 09:35:46.387 UTC
// 15:08:42.000 IST = 09:38:42.000 UTC
const FROM_UTC = new Date('2026-06-23T09:35:46.387Z');
const TO_UTC   = new Date('2026-06-23T09:38:42.000Z');

async function checkDatabase(uri, label) {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('trainflow');
        console.log(`=== ${label} DATABASE ===`);
        
        // Find train events in this range
        const events = await db.collection('trainevents').find({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        }).toArray();
        console.log(`Events count: ${events.length}`);
        events.forEach(e => {
            console.log(`  Event ID: ${e._id}, Type: ${e.type}, StartIST: ${e.startTimeIST}, EndIST: ${e.endTimeIST}, Duration: ${e.duration}ms, Direction: ${e.direction}`);
        });

        // Find mqttrecords count
        const recordsCount = await db.collection('mqttrecords').countDocuments({
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`mqttrecords count: ${recordsCount}`);

        if (recordsCount > 0) {
            const first = await db.collection('mqttrecords').findOne({ receivedAt: { $gte: FROM_UTC, $lte: TO_UTC } }, { sort: { receivedAt: 1 } });
            const last = await db.collection('mqttrecords').findOne({ receivedAt: { $gte: FROM_UTC, $lte: TO_UTC } }, { sort: { receivedAt: -1 } });
            console.log(`  First record receivedAt: ${first.receivedAt} (${first.localTime || ''})`);
            console.log(`  Last record receivedAt: ${last.receivedAt} (${last.localTime || ''})`);
        }
        console.log();
    } catch (err) {
        console.error(`Error checking ${label}:`, err.message);
    } finally {
        await client.close();
    }
}

async function main() {
    console.log(`Checking timeframe: 2026-06-23 15:05:46.387 IST to 15:08:42.000 IST\n`);
    await checkDatabase(LOCAL_URI, 'LOCAL');
    await checkDatabase(REMOTE_URI, 'REMOTE');
}

main();
