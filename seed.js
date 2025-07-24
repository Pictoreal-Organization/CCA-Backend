require('dotenv').config();
require('./db'); // MongoDB connection
const { Member, Team, Meeting } = require('./models/schema'); // Import models

async function seed() {
  try {
    // Step 1: Create a member (initially with empty teams)
    const member1 = await Member.create({
      name: 'John Doe',
      rollNo: '1234',
      year: 'TE',
      division: '10',
      email: 'johnDoe@gmail.com',
      phone: '1234567890',
      team: [] // will be updated later
    });

    const member2 = await Member.create({
      name: 'Sarah Smith',
      rollNo: '1234',
      year: 'TE',
      division: '11',
      email: 'sarahsmith@gmail.com',
      phone: '1234567809',
      team: [] // will be updated later
    });

    // Step 2: Create a team and add the member to it
    const team = await Team.create({
      name: 'Core Dev Team',
      members: [member1._id, member2._id],
    });

    // Step 3: Update member's team array to include this team
    member1.team.push(team._id);
    await member1.save();
    member2.team.push(team._id);
    await member2.save();

    // Step 4: Create a meeting referencing team and member as organizer
    const meeting = await Meeting.create({
      title: 'Welcome Meet',
      description: 'Kickoff discussion',
      location: 'Room 101',
      dateTime: new Date(),
      organizer: member1._id,
      team: team._id,
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
