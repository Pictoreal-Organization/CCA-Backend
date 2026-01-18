require('dotenv').config();
const mongoose = require('mongoose');
const Role = require('./models/role.model');

const migrateUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const adminRole = await Role.findOne({ slug: 'admin' });
    const headRole = await Role.findOne({ slug: 'head' });
    const memberRole = await Role.findOne({ slug: 'member' });

    if (!adminRole || !headRole || !memberRole) {
      console.error('Roles not found. Run seed_roles.js first.');
      process.exit(1);
    }

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Update Admins
    const adminUpdate = await usersCollection.updateMany(
      { role: 'Admin' },
      { $set: { role: adminRole._id } }
    );
    console.log(`Updated ${adminUpdate.modifiedCount} Admins`);

    // Update Heads
    const headUpdate = await usersCollection.updateMany(
      { role: 'Head' },
      { $set: { role: headRole._id } }
    );
    console.log(`Updated ${headUpdate.modifiedCount} Heads`);

    // Update Members
    const memberUpdate = await usersCollection.updateMany(
      { role: 'Member' },
      { $set: { role: memberRole._id } }
    );
    console.log(`Updated ${memberUpdate.modifiedCount} Members`);
    
    // Also catch lowercase or default cases if any
    const defaultAvailable = await usersCollection.updateMany(
      { role: { $nin: [adminRole._id, headRole._id, memberRole._id] } },
      { $set: { role: memberRole._id } }
    );
    console.log(`Updated ${defaultAvailable.modifiedCount} users to default Member role`);

    console.log('User migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error migrating users:', error);
    process.exit(1);
  }
};

migrateUsers();
