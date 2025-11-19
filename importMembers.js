const fs = require('fs');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
require('./db');

const { User, Team } = require('./models/index');

(async () => {
  const results = [];

  fs.createReadStream('All_csvs/members.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        for (const row of results) {
          const name = row['Name']?.trim();
          const email = row['Email']?.trim()?.toLowerCase();
          const year = row['Year']?.trim(); 
          const department = row['Department']?.trim();
          const phone = row['MobileNo']?.replace(/\D/g, '').trim();
          const rollNo = row['RollNo']?.trim();
          const teams1 = row['Teams1']
            ?.split(',')
            .map(t => t.trim());
          const teams2 = row['Teams2']
            ?.split(',')
            .map(t => t.trim());
          const allTeams = [...new Set([...(teams1 || []), ...(teams2 || [])])];

          if (!email) {
            console.log(`⚠️ Skipping invalid entry (missing email): ${JSON.stringify(row)}`);
            continue;
          }

          // Generate username and password
          const username = email.split('@')[0];
          const initialPassword = username;

          // 🔄 Find user or create new one
          let user = await User.findOne({ email });

          if (user) {
            // ✅ Update existing user
            user.username = username;
            user.name = name || user.name;
            user.rollNo = rollNo || user.rollNo;
            user.year = year || user.year;
            user.division = department || user.division;
            user.phone = phone || user.phone;
            user.initialPassword = user.initialPassword || initialPassword;
            user.role = 'Member';
            console.log(`🔄 Updating existing user: ${email}`);
            if (!user.fcmTokens) {
                user.fcmTokens = [];
            }
          } else {
            // ✅ Create new user
            user = new User({
              username,
              email,
              password: initialPassword,
              name,
              rollNo,
              year,
              division: department,
              phone,
              initialPassword,
              role: 'Member',
              fcmTokens: [],
            });
            console.log(`🆕 Creating new user: ${email}`);
          }

          // Save (to ensure user has _id for teams)
          await user.save();

          // ✅ Assign teams (add if not already)
          for (const teamName of allTeams) {
            if (!teamName) continue;

            let team = await Team.findOne({ name: teamName });
            if (!team) {
              team = await Team.create({ name: teamName });
              console.log(`🆕 Created team: ${teamName}`);
            }

            // Add user to team if not already a member
            if (!team.members.includes(user._id)) {
              team.members.push(user._id);
              await team.save();
            }

            // Add team to user's list if not already
            if (!user.team.includes(team._id)) {
              user.team.push(team._id);
            }
          }

          await user.save();

          console.log(`✅ Processed: ${name || 'Unnamed'} | Username: ${username}`);
        }

        console.log('\n🎉 All users imported/updated successfully!');
      } catch (err) {
        console.error('❌ Import error:', err);
      } finally {
        mongoose.connection.close();
      }
    });
})();
