/**
 * Compare local and remote MongoDB databases
 */
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const REMOTE_URI = 'mongodb://16.176.209.82:27017/trainflow';

async function main() {
    const localClient = new MongoClient(LOCAL_URI);
    const remoteClient = new MongoClient(REMOTE_URI);
    
    try {
        await localClient.connect();
        await remoteClient.connect();
        
        const localDb = localClient.db('trainflow');
        const remoteDb = remoteClient.db('trainflow');
        
        console.log('=== COLLECTION COMPARISON ===');
        const collections = ['trainevents', 'mqttrecords', 'users'];
        
        for (const colName of collections) {
            const localCount = await localDb.collection(colName).countDocuments({});
            const remoteCount = await remoteDb.collection(colName).countDocuments({});
            console.log(`Collection: ${colName}`);
            console.log(`  Local count:  ${localCount}`);
            console.log(`  Remote count: ${remoteCount}`);
        }
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await localClient.close();
        await remoteClient.close();
    }
}

main();
