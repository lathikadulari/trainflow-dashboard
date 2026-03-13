const mongoose = require('mongoose');

let isConnected = false;
let hasLoggedError = false;
let retryTimeout = null;

const connectDB = async () => {
    // Don't try to reconnect if already connected
    if (isConnected) return;

    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000, // 10 second timeout
        });
        isConnected = true;
        hasLoggedError = false; // Reset error flag on successful connection
        console.log(`MongoDB: Connected to ${conn.connection.host}`);

        // Clear any pending retry
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
    } catch (error) {
        isConnected = false;

        // Only log the first error to avoid spam
        if (!hasLoggedError) {
            console.log('MongoDB: Connection unavailable - will keep retrying silently');
            hasLoggedError = true;
        }

        // Retry connection every 5 seconds (silently)
        retryTimeout = setTimeout(() => {
            connectDB();
        }, 5000);
    }
};

// Handle connection events for reconnection
mongoose.connection.on('disconnected', () => {
    if (isConnected) {
        console.log('MongoDB: Disconnected - will attempt to reconnect');
        isConnected = false;
        // Retry connection
        retryTimeout = setTimeout(() => {
            connectDB();
        }, 5000);
    }
});

mongoose.connection.on('connected', () => {
    isConnected = true;
});

// Export connection status checker
const getConnectionStatus = () => isConnected;

module.exports = connectDB;
module.exports.getConnectionStatus = getConnectionStatus;

