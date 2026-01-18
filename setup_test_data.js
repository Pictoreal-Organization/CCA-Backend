require('dotenv').config();
const mongoose = require('mongoose');
const { User, Team, Tag, Role } = require('./models');

// Use the TEST DB URI directly
const TEST_URI = 'mongodb+srv://riddhi:riddhi_atlas_pw@cluster0.bzzm3.mongodb.net/';

const setupTestData = async () => {
  try {
    await mongoose.connect(TEST_URI);
    console.log('Connected to Test MongoDB:', TEST_URI);

    // 1. Get Roles
    const adminRole = await Role.findOne({ slug: 'admin' });
    const coordRole = await Role.findOne({ slug: 'coordinator' });

    if (!adminRole || !coordRole) {
      console.error('Roles missing. Run seed_roles.js');
      process.exit(1);
    }

    // 2. Create Test Tag
    const testTag = await Tag.findOneAndUpdate(
      { name: 'TestTag' },
      { name: 'TestTag', isActive: true },
      { upsert: true, new: true }
    );
    console.log('TestTag created:', testTag._id);

    // 3. Create Test Admin
    // Using delete one + create new approach to ensure clean state and password hashing checks
    await User.deleteOne({ email: 'test_admin@cca.com' });
    
    // Create new admin
    // Note: User model has pre-save hook for password hashing
    const newAdmin = new User({
      username: 'test_admin',
      email: 'test_admin@cca.com',
      password: 'password123',
      role: adminRole._id,
      name: 'Test Admin',
      fcmTokens: []
    });
    await newAdmin.save();
    console.log('Test Admin created (password123)');

    // 4. Create Test Coordinator
    await User.deleteOne({ email: 'test_coord@cca.com' });
    const newCoord = new User({
      username: 'test_coord',
      email: 'test_coord@cca.com',
      password: 'password123',
      role: coordRole._id,
      name: 'Test Coordinator',
      tag: testTag._id,
      fcmTokens: []
    });
    await newCoord.save();
    console.log('Test Coordinator created (password123) with Tag:', testTag.name);

    process.exit(0);
  } catch (error) {
    console.error('Error setting up test data:', error);
    process.exit(1);
  }
};

setupTestData();
