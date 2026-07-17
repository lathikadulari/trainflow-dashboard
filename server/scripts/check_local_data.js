/**
 * Check local MongoDB for sensor data between 7:44 AM - 7:55 AM IST
 * and create a train event if data exists but no event was recorded.
 */
const { MongoClient, ObjectId } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

// 7:44 AM IST = 02:14 UTC, 7:55 AM IST = 02:25 UTC
const FROM_UTC = new Date('2026-06-23T02:14:00.000Z');
const TO_UTC   = new Date('2026-06-23T02:25:00.000Z');

async function main() {
    const client = new MongoClient(LOCAL_URI);
    
    try {
        await client.connect();
        console.log('✅ Connected to local MongoDB\n');
        const db = client.db('trainflow');

        // Check for existing train events in this range
        console.log('=== Train Events (7:44 AM - 7:55 AM IST) ===');
        const events = await db.collection('trainevents').find({
            startTime: { $gte: FROM_UTC, $lte: TO_UTC }
        }).sort({ startTime: -1 }).toArray();
        
        console.log(`Found ${events.length} train events`);
        events.forEach((e, i) => {
            console.log(`  Event ${i+1}: _id=${e._id}, type=${e.type}, start=${e.startTimeIST || e.startTime}, end=${e.endTimeIST || e.endTime}, duration=${e.duration}ms, active=${e.active}`);
        });

        // Check sensor records
        console.log('\n=== Sensor Records (7:44 AM - 7:55 AM IST) ===');
        const sensorCount = await db.collection('mqttrecords').countDocuments({
            station: 'makumbura',
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`Total sensor records: ${sensorCount}`);

        const sensor1Count = await db.collection('mqttrecords').countDocuments({
            station: 'makumbura', sensorId: 'sensor1',
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        const sensor2Count = await db.collection('mqttrecords').countDocuments({
            station: 'makumbura', sensorId: 'sensor2',
            receivedAt: { $gte: FROM_UTC, $lte: TO_UTC }
        });
        console.log(`  Sensor 1 (Right): ${sensor1Count}`);
        console.log(`  Sensor 2 (Left): ${sensor2Count}`);

        // Show first and last record timestamps
        if (sensorCount > 0) {
            const first = await db.collection('mqttrecords').findOne(
                { station: 'makumbura', sensorId: { $in: ['sensor1', 'sensor2'] }, receivedAt: { $gte: FROM_UTC, $lte: TO_UTC } },
                { sort: { receivedAt: 1 } }
            );
            const last = await db.collection('mqttrecords').findOne(
                { station: 'makumbura', sensorId: { $in: ['sensor1', 'sensor2'] }, receivedAt: { $gte: FROM_UTC, $lte: TO_UTC } },
                { sort: { receivedAt: -1 } }
            );
            console.log(`  First record: ${first.receivedAt} (${first.localTime || ''})`);
            console.log(`  Last record:  ${last.receivedAt} (${last.localTime || ''})`);
        }

        // Also check wider range (with 2-min buffer)
        const wideFrom = new Date(FROM_UTC.getTime() - 2 * 60 * 1000);
        const wideTo = new Date(TO_UTC.getTime() + 2 * 60 * 1000);
        const wideCount = await db.collection('mqttrecords').countDocuments({
            station: 'makumbura',
            sensorId: { $in: ['sensor1', 'sensor2'] },
            receivedAt: { $gte: wideFrom, $lte: wideTo }
        });
        console.log(`\n=== Wider range (7:42 AM - 7:57 AM IST) ===`);
        console.log(`Total sensor records: ${wideCount}`);

        // Check all events around this time
        console.log('\n=== All Train Events Today ===');
        const todayStart = new Date('2026-06-22T18:30:00.000Z'); // midnight IST
        const todayEnd = new Date('2026-06-23T18:30:00.000Z');
        const todayEvents = await db.collection('trainevents').find({
            startTime: { $gte: todayStart, $lte: todayEnd }
        }).sort({ startTime: -1 }).toArray();
        
        console.log(`Found ${todayEvents.length} events today`);
        todayEvents.forEach((e, i) => {
            const startIST = e.startTimeIST || new Date(e.startTime).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' });
            console.log(`  ${i+1}. type=${e.type}, start=${startIST}, duration=${e.duration ? (e.duration/1000).toFixed(1) + 's' : 'active'}, notes=${e.notes || ''}`);
        });

        // If we have sensor data but no event, create one
        if (events.length === 0 && sensorCount > 0) {
            console.log('\n📝 No train event exists for 7:44-7:55 AM but sensor data was found.');
            console.log('Creating a train event...');
            
            const newEvent = {
                station: 'Makumbura',
                type: 'approaching',
                startTime: FROM_UTC,
                startTimeIST: '23/06/2026, 07:44:00.000 IST',
                endTime: TO_UTC,
                endTimeIST: '23/06/2026, 07:55:00.000 IST',
                duration: TO_UTC.getTime() - FROM_UTC.getTime(), // 660000ms = 11min
                notes: 'Manually created - missed train event',
                active: false
            };

            const result = await db.collection('trainevents').insertOne(newEvent);
            console.log(`✅ Created train event: ${result.insertedId}`);
            console.log(`   Duration: ${newEvent.duration / 1000}s (${(newEvent.duration / 60000).toFixed(1)} min)`);
        } else if (events.length === 0 && sensorCount === 0) {
            console.log('\n⚠️  No sensor data and no train events found in this time range locally.');
            console.log('Your local server may not have been running at that time.');
            console.log('The data would only be on the EC2 server if the backend was running there.');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.close();
    }
}

main();
