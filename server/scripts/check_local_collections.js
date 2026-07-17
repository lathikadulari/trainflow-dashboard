const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';

async function main() {
    const client = new MongoClient(LOCAL_URI);
    try {
        await client.connect();
        const db = client.db('trainflow');
        const collections = await db.listCollections().toArray();
        console.log('Local collections:', collections.map(c => c.name));
        
        for (const col of collections) {
            const count = await db.collection(col.name).countDocuments({});
            console.log(`- ${col.name}: ${count} docs`);
            if (col.name === 'users') {
                const users = await db.collection('users').find({}).toArray();
                console.log('Users:', users.map(u => ({ _id: u._id, username: u.username, role: u.role })));
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

main();
