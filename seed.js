require('dotenv').config();
require('./db'); // Import MongoDB connection
const { Member, Team, Meeting } = require('./models/schema'); // Import models

async function seed() {
  try {
    // Create a member
    const member = await Member.create({
      name: 'John Doe',
      rollNo: '1234',
      year: 'TE',
      division: 'B'
    });

    // Create a team and assign member
    const team = await Team.create({
      name: 'Core Dev Team',
      members: [member._id]
    });

    // Create a meeting and reference both team and member as organizer
    const meeting = await Meeting.create({
      title: 'Welcome Meet',
      description: 'Kickoff discussion',
      location: 'Room 101',
      dateTime: new Date(),
      organizer: member._id, // use ObjectId of member
      team: team._id,        // use ObjectId of team
      agenda: 'Orientation and overview',
      priority: 'High'
    });

    console.log('🌱 Seed data inserted successfully');
    process.exit(0);
  } catch (err) {
    console.error('⚠️ Error inserting seed data:', err.message);
    process.exit(1);
  }
}

seed();
