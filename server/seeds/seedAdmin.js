const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists!');
            process.exit(0);
        }

        // Create admin user (password must be at least 6 characters)
        const adminUser = await User.create({
            username: 'admin',
            password: 'admin123'  // Will be hashed automatically by the pre-save hook
        });

        console.log('Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

seedAdmin();
