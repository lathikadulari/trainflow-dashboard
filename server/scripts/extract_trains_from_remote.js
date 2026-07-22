const { MongoClient } = require('mongodb');

const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';
const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

async function main() {
    const remoteClient = new MongoClient(REMOTE_URI);
    const localClient = new MongoClient(LOCAL_URI);

    try {
        await remoteClient.connect();
        await localClient.connect();
        console.log('Connected to both databases.');

        const remoteDb = remoteClient.db('trainflow');
        const localDb = localClient.db('trainflow');

        // Times in UTC (Colombo is UTC+5:30)
        // Train 1: 5:01 PM - 5:08 PM IST
        const train1Start = new Date('2026-06-23T11:31:00.000Z');
        const train1End = new Date('2026-06-23T11:38:00.000Z');

        // Train 2: 5:29 PM - 5:34 PM IST
        const train2Start = new Date('2026-06-23T11:59:00.000Z');
        const train2End = new Date('2026-06-23T12:04:00.000Z');

        // Find events on remote that overlap these times
        const remoteEvents = await remoteDb.collection('trainevents').find({
            startTime: { $gte: new Date('2026-06-23T00:00:00Z') }
        }).toArray();
        
        console.log('Remote events today:');
        remoteEvents.forEach(e => {
            console.log(e._id, e.startTime, e.endTime, e.type);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await remoteClient.close();
        await localClient.close();
    }
}

main();
