const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trainflow';
const CSV_PATH = path.join(__dirname, '../../docs/makumbura_sd_train.csv');
const START_TIMESTAMP = Date.parse('2026-06-23T11:00:00.000Z'); // Start date/time for dataset

async function importVibrationCSV() {
    try {
        console.log(`Connecting to MongoDB at: ${MONGO_URI}...`);
        await mongoose.connect(MONGO_URI);

        const db = mongoose.connection.db;
        const collectionName = 'vibrationrecords';
        const collection = db.collection(collectionName);

        // Drop existing collection to prevent duplicate imports
        const existingCols = await db.listCollections({ name: collectionName }).toArray();
        if (existingCols.length > 0) {
            console.log(`Dropping existing collection "${collectionName}"...`);
            await collection.drop();
        }

        console.log(`Reading CSV file from: ${CSV_PATH}...`);
        const fileStream = fs.createReadStream(CSV_PATH);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let headers = [];
        let isFirstLine = true;
        let batch = [];
        let totalInserted = 0;
        const BATCH_SIZE = 5000;

        console.log('Starting bulk insertion into MongoDB with Date timestamps...');

        for await (const line of rl) {
            if (!line.trim()) continue;

            if (isFirstLine) {
                headers = line.split(',').map(h => h.trim());
                isFirstLine = false;
                continue;
            }

            const parts = line.split(',').map(p => p.trim());
            if (parts.length < headers.length) continue;

            const doc = {};
            headers.forEach((header, idx) => {
                const numVal = parseFloat(parts[idx]);
                doc[header] = isNaN(numVal) ? parts[idx] : numVal;
            });

            // Calculate precise collection date & time for sample
            const sampleIdx = doc.sample_index || 0;
            doc.collectedAt = new Date(START_TIMESTAMP + (sampleIdx * 100)); // 100ms per sample (10 Hz)
            doc.station = 'Makumbura';

            batch.push(doc);

            if (batch.length >= BATCH_SIZE) {
                await collection.insertMany(batch, { ordered: false });
                totalInserted += batch.length;
                console.log(`Inserted ${totalInserted} records with timestamps...`);
                batch = [];
            }
        }

        if (batch.length > 0) {
            await collection.insertMany(batch, { ordered: false });
            totalInserted += batch.length;
        }

        console.log(`\nSuccess! Total ${totalInserted} vibration records imported into collection "${collectionName}".`);

        // Create indexes
        await collection.createIndex({ sample_index: 1 });
        await collection.createIndex({ collectedAt: 1 });
        console.log('Indexes created on sample_index and collectedAt.');

        await mongoose.disconnect();
        console.log('MongoDB connection closed.');
    } catch (err) {
        console.error('Error importing CSV to MongoDB:', err);
        process.exit(1);
    }
}

importVibrationCSV();
