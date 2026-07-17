require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trainflow';
const dumpDir = path.join(__dirname, 'db_dump');

async function main() {
    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;

    if (!fs.existsSync(dumpDir)) {
        console.error(`Dump directory not found at ${dumpDir}!`);
        mongoose.connection.close();
        return;
    }

    const files = fs.readdirSync(dumpDir).filter(f => f.endsWith('.json'));
    
    // Group split files (e.g. mqttrecords_part01.json, mqttrecords_part02.json)
    const collectionFiles = {};
    for (const file of files) {
        const match = file.match(/^(.+?)(_part\d+)?\.json$/);
        if (match) {
            const collName = match[1];
            if (!collectionFiles[collName]) collectionFiles[collName] = [];
            collectionFiles[collName].push(file);
        }
    }

    console.log(`Found collections to import: ${Object.keys(collectionFiles).join(', ')}`);

    for (const [collectionName, jsonFiles] of Object.entries(collectionFiles)) {
        console.log(`\n--- Importing collection '${collectionName}' from ${jsonFiles.length} file(s) ---`);
        
        // Clear existing data
        console.log(`  Clearing existing documents in '${collectionName}'...`);
        await db.collection(collectionName).deleteMany({});

        let totalImported = 0;

        for (const file of jsonFiles.sort()) {
            const filePath = path.join(dumpDir, file);
            console.log(`  Reading ${file}...`);
            const rawData = fs.readFileSync(filePath, 'utf8');
            const documents = JSON.parse(rawData);

            if (documents.length === 0) {
                console.log(`  ${file} is empty. Skipping.`);
                continue;
            }

            // Convert ObjectID and Date fields
            const parsedDocs = documents.map(doc => {
                const parsed = { ...doc };
                if (parsed._id && parsed._id.$oid) {
                    parsed._id = new mongoose.Types.ObjectId(parsed._id.$oid);
                } else if (typeof parsed._id === 'string' && parsed._id.length === 24) {
                    parsed._id = new mongoose.Types.ObjectId(parsed._id);
                }
                for (const key of Object.keys(parsed)) {
                    if (parsed[key] && parsed[key].$date) {
                        parsed[key] = new Date(parsed[key].$date);
                    } else if ((key.endsWith('At') || key.endsWith('Time') || key === 'timestamp') && typeof parsed[key] === 'string') {
                        parsed[key] = new Date(parsed[key]);
                    }
                }
                return parsed;
            });

            // Insert in batches of 5000 to avoid memory issues
            const BATCH_SIZE = 5000;
            for (let i = 0; i < parsedDocs.length; i += BATCH_SIZE) {
                const batch = parsedDocs.slice(i, i + BATCH_SIZE);
                await db.collection(collectionName).insertMany(batch);
            }
            totalImported += parsedDocs.length;
            console.log(`  Inserted ${parsedDocs.length} documents from ${file}.`);
        }

        console.log(`  Total: ${totalImported} documents imported into '${collectionName}'.`);
    }

    mongoose.connection.close();
    console.log("\n✅ Database import completed successfully!");
}

main().catch(err => {
    console.error(err);
    if (mongoose.connection) mongoose.connection.close();
});
