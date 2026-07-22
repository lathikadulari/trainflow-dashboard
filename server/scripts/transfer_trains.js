const { MongoClient } = require('mongodb');

const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';
const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

async function transferData(remoteDb, localDb, startTime, endTime, trainLabel) {
    console.log(`\n--- Starting transfer for ${trainLabel} (${startTime.toISOString()} to ${endTime.toISOString()}) ---`);
    
    const records = await remoteDb.collection('mqttrecords').find({
        receivedAt: { $gte: startTime, $lte: endTime }
    }).toArray();

    console.log(`Found ${records.length} records on remote for ${trainLabel}.`);

    if (records.length === 0) {
        console.log(`No records found for ${trainLabel}. Skipping.`);
        return;
    }

    // Insert records in batches
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        try {
            // Using ordered: false so if some already exist, it will continue inserting the rest
            const result = await localDb.collection('mqttrecords').insertMany(batch, { ordered: false });
            insertedCount += result.insertedCount;
            console.log(`Inserted batch ${i/batchSize + 1}: ${result.insertedCount} records.`);
        } catch (err) {
            if (err.code === 11000) {
                // Duplicate key error, some records might have been inserted
                console.log(`Batch ${i/batchSize + 1} had some duplicate keys. Inserted: ${err.result?.nInserted || 0}`);
                insertedCount += (err.result?.nInserted || 0);
            } else {
                console.error(`Error inserting batch ${i/batchSize + 1}:`, err.message);
            }
        }
    }
    console.log(`Successfully inserted ${insertedCount} mqttrecords for ${trainLabel}.`);

    // Create a trainevent for this train
    const event = {
        startTime: startTime,
        endTime: endTime,
        type: 'stopped', // Default type, can be updated later
        direction: 'unknown',
        speed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        notes: `Imported from remote: ${trainLabel}`
    };

    try {
        const eventResult = await localDb.collection('trainevents').insertOne(event);
        console.log(`Created trainevent for ${trainLabel} with id: ${eventResult.insertedId}`);
    } catch (err) {
        console.error(`Error creating trainevent for ${trainLabel}:`, err.message);
    }
}

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
        // Train 1: 5:01 PM - 5:08 PM IST (11:31 - 11:38 UTC)
        const train1Start = new Date('2026-06-23T11:31:00.000Z');
        const train1End = new Date('2026-06-23T11:38:00.000Z');
        await transferData(remoteDb, localDb, train1Start, train1End, "Train 1 (5:01 PM - 5:08 PM)");

        // Train 2: 5:29 PM - 5:34 PM IST (11:59 - 12:04 UTC)
        const train2Start = new Date('2026-06-23T11:59:00.000Z');
        const train2End = new Date('2026-06-23T12:04:00.000Z');
        await transferData(remoteDb, localDb, train2Start, train2End, "Train 2 (5:29 PM - 5:34 PM)");

    } catch (err) {
        console.error("Main execution error:", err);
    } finally {
        await remoteClient.close();
        await localClient.close();
        console.log('Database connections closed.');
    }
}

main();
