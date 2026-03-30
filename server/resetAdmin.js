const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const resetAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');

        // Check if admin user already exists
        const adminUser = await User.findOne({ username: 'admin' });
        if (adminUser) {
            console.log('Admin user found! Resetting password...');
            adminUser.password = 'admin123';
            await adminUser.save();
            console.log('Admin password explicitly set to admin123');
        } else {
            console.log('Admin user not found, creating from scratch...');
            await User.create({
                username: 'admin',
                password: 'admin123'
            });
            console.log('Admin user created successfully!');
        }
        process.exit(0);
    } catch (error) {
        console.error('Error resetting admin user:', error);
        process.exit(1);
    }
};

resetAdmin();
