const fs = require('fs');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
require('./db');

const { User, Team } = require('./models/index');

(async () => {
  const results = [];

  fs.createReadStream('responses1.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          const name = row['Name']?.trim();
          const email = row['Email Address']?.trim()?.toLowerCase();
          const year = row['Year']?.trim(); // e.g. SY, TY
          const department = row['Department']?.trim();
          const phone = row['Mobile Number']?.replace(/\D/g, '').trim();
          const teamList = row['Select one or more from the following teams']?.split(',').map(t => t.trim());
          const moreTeams = row['Select more teams you wish to contribute in below']?.split(',').map(t => t.trim());
          const allTeams = [...new Set([...(teamList || []), ...(moreTeams || [])])];

          if (!email) {
            console.log(`⚠️ Skipping invalid entry (missing email): ${JSON.stringify(row)}`);
            continue;
          }

          // Generate username from email (before '@')
          const username = email.split('@')[0];
          const initialPassword = username; // you can later ask them to change it

          // Check if user already exists
          const existingUser = await User.findOne({ email });
          if (existingUser) {
            console.log(`⚠️ Skipping existing user: ${email}`);
            continue;
          }

          // Create user (no team refs yet)
          const user = new User({
            username,
            email,
            password: initialPassword,
            name,
            year,
            division: department,
            phone,
            initialPassword,
            role: 'Member',
          });

          await user.save();

          // Assign teams
          for (const teamName of allTeams) {
            if (!teamName) continue;

            let team = await Team.findOne({ name: teamName });
            if (!team) {
              team = await Team.create({ name: teamName });
              console.log(`🆕 Created team: ${teamName}`);
            }

            team.members.push(user._id);
            await team.save();

            user.team.push(team._id);
          }

          await user.save();

          console.log(`✅ Imported: ${name || 'Unnamed'} | Username: ${username}`);
        }

        console.log('\n🎉 All users imported successfully!');
      } catch (err) {
        console.error('❌ Import error:', err);
      } finally {
        mongoose.connection.close();
      }
    });
})();
