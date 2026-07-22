/**
 * List all train events in local and remote databases
 */
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://localhost:27017/trainflow';
const REMOTE_URI = 'mongodb://13.201.26.123:27017/trainflow';

async function main() {
    const localClient = new MongoClient(LOCAL_URI);
    const remoteClient = new MongoClient(REMOTE_URI);
    
    try {
        await localClient.connect();
        await remoteClient.connect();
        
        const localDb = localClient.db('trainflow');
        const remoteDb = remoteClient.db('trainflow');
        
        console.log('=== LOCAL TRAIN EVENTS ===');
        const localEvents = await localDb.collection('trainevents').find({}).sort({ startTime: 1 }).toArray();
        localEvents.forEach((e, i) => {
            console.log(`${i+1}. ID: ${e._id}, Type: ${e.type}, StartIST: ${e.startTimeIST}, EndIST: ${e.endTimeIST || 'N/A'}, Duration: ${e.duration}ms`);
        });
        
        console.log('\n=== REMOTE TRAIN EVENTS ===');
        const remoteEvents = await remoteDb.collection('trainevents').find({}).sort({ startTime: 1 }).toArray();
        remoteEvents.forEach((e, i) => {
            console.log(`${i+1}. ID: ${e._id}, Type: ${e.type}, StartIST: ${e.startTimeIST}, EndIST: ${e.endTimeIST || 'N/A'}, Duration: ${e.duration}ms`);
        });
        
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await localClient.close();
        await remoteClient.close();
    }
}

main();
