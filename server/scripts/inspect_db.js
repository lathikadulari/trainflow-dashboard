require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

async function inspectDB() {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trainflow';
        console.log(`Connecting to MongoDB at: ${uri}...\n`);
        await mongoose.connect(uri);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        if (collections.length === 0) {
            console.log('No collections found in database.');
            process.exit(0);
        }

        console.log(`=== MongoDB Database: "${db.databaseName}" ===\n`);
        
        for (const colInfo of collections) {
            const collectionName = colInfo.name;
            const collection = db.collection(collectionName);
            const count = await collection.countDocuments();
            console.log(`📁 Collection: [ ${collectionName} ] (${count} documents)`);

            if (count > 0) {
                const samples = await collection.find({}).limit(2).toArray();
                console.log('   Sample Document(s):');
                console.log(JSON.stringify(samples, null, 2).split('\n').map(line => '   ' + line).join('\n'));
            } else {
                console.log('   (Empty collection)');
            }
            console.log('\n----------------------------------------\n');
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error inspecting MongoDB:', err);
        process.exit(1);
    }
}

inspectDB();
