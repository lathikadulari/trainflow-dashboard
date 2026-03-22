const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function seedAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB connected');

        // Check if admin already exists
        const existing = await User.findOne({ username: 'admin' });
        if (existing) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user (password will be auto-hashed by User model pre-save hook)
        const user = await User.create({
            username: 'admin',
            password: 'admin123'
        });

        console.log('Admin user created successfully:', user.username);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

seedAdmin();
