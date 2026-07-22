/**
 * Check remote/cloud MongoDB for train events and sensor records
 */
const { MongoClient } = require('mongodb');

const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';

async function main() {
    console.log('Connecting to remote MongoDB:', REMOTE_URI);
    const client = new MongoClient(REMOTE_URI, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000
    });
    
    try {
        await client.connect();
        console.log('✅ Connected to remote MongoDB\n');
        const db = client.db('trainflow');

        // Check collections
        const collections = await db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name).join(', '));

        // Check today's events on remote
        console.log('\n=== Train Events on Remote Today ===');
        const todayStart = new Date('2026-06-22T18:30:00.000Z'); // midnight IST
        const todayEnd = new Date('2026-06-23T18:30:00.000Z');
        const events = await db.collection('trainevents').find({
            startTime: { $gte: todayStart, $lte: todayEnd }
        }).sort({ startTime: -1 }).toArray();

        console.log(`Found ${events.length} train events today on Remote`);
        events.forEach((e, i) => {
            const startIST = e.startTimeIST || new Date(e.startTime).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
            console.log(`  ${i+1}. _id=${e._id}, type=${e.type}, start=${startIST}, duration=${e.duration ? (e.duration/1000).toFixed(1) + 's' : 'active'}, notes=${e.notes || ''}`);
        });

        // Check sensor records count
        const totalRecords = await db.collection('mqttrecords').countDocuments({});
        console.log(`\nTotal mqttrecords on Remote: ${totalRecords}`);

        const todayRecords = await db.collection('mqttrecords').countDocuments({
            receivedAt: { $gte: todayStart, $lte: todayEnd }
        });
        console.log(`Today's mqttrecords on Remote: ${todayRecords}`);

    } catch (err) {
        console.error('❌ Error connecting to remote MongoDB:', err.message);
    } finally {
        await client.close();
    }
}

main();
