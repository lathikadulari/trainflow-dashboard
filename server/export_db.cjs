require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trainflow';
const dumpDir = path.join(__dirname, 'db_dump');

async function main() {
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir);
    }

    console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log(`Found collections: ${collections.map(c => c.name).join(', ')}`);

    for (const coll of collections) {
        const name = coll.name;
        console.log(`Exporting collection '${name}' via stream...`);
        
        const filePath = path.join(dumpDir, `${name}.json`);
        const writeStream = fs.createWriteStream(filePath, 'utf8');
        writeStream.write('[\n');

        const cursor = db.collection(name).find({});
        let count = 0;
        let first = true;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            if (!first) {
                writeStream.write(',\n');
            }
            // Format indentation slightly
            const docStr = JSON.stringify(doc, null, 2)
                .split('\n')
                .map(line => '  ' + line)
                .join('\n');
            writeStream.write(docStr);
            first = false;
            count++;

            if (count % 50000 === 0) {
                console.log(`  Exported ${count} records...`);
            }
        }

        writeStream.write('\n]');
        
        await new Promise((resolve, reject) => {
            writeStream.end(err => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`Successfully exported ${count} documents to ${filePath}`);
    }

    mongoose.connection.close();
    console.log("\nAll collections exported successfully! You can find the JSON files in 'server/db_dump/'.");
}

main().catch(err => {
    console.error(err);
    if (mongoose.connection) {
        mongoose.connection.close();
    }
});
