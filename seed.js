require('dotenv').config();
require('./db'); // Import MongoDB connection
const { Member, Team, Meeting } = require('./models/schema'); // Import models

async function seed() {
  try {
    const member = await Member.create({
      name: 'John Doe',
      rollNo: '1234',
      year: 'TE',
      division: 'B'
    });

    const team = await Team.create({
      name: 'Core Dev Team',
      members: [member._id]
    });

    const meeting = await Meeting.create({
      title: 'Welcome Meet',
      description: 'Kickoff discussion',
      location: 'Room 101',
      dateTime: new Date(),
      organizer: 'Admin User',
    });

    console.log('🌱 Seed data inserted successfully');
    process.exit(0);
  } catch (err) {
    console.error('⚠️ Error inserting seed data:', err);
    process.exit(1);
  }
}

seed();
