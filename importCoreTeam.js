const fs = require('fs');
const csv = require('csv-parser');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
require('./db');

const { User, Team } = require('./models/index');

(async () => {
  const rows = [];

  fs.createReadStream('All_csvs/core_team.csv')
    .pipe(csv())
    .on('data', row => rows.push(row))
    .on('end', async () => {
      try {
        for (const r of rows) {
          const isCore = (r['Are you from BE Core, EMs, or PROs?'] || "")
            .trim()
            .toLowerCase() === "yes";

          const email = r['Email']?.trim()?.toLowerCase();
          if (!email) {
            console.log("⚠️ No email, skipping row");
            continue;
          }

          const name = r['Name']?.trim();
          const phone = r['MobileNo']?.replace(/\D/g, '').trim();
          const year = r['Year']?.trim();
          const dept = r['Department']?.trim();
          const rollNo = r['RollNo']?.trim();

          const headOf = r['Head of']?.trim();
          const position = r['Position']?.trim();

          // -------------------------------------------
          // FIGURE OUT FINAL TEAM NAME BASED ON RULES
          // -------------------------------------------

          let teamName = null;

          if (!isCore) {
            // CASE 1 — Normal head -> use Head of column
            if (!headOf) {
              console.log(`⚠️ Missing Head of for NON-core: ${email}`);
              continue;
            }
            teamName = headOf;

          } else {
            // CASE 2 — Core member -> use Position column
            if (!position) {
              console.log(`⚠️ Missing Position for CORE member: ${email}`);
              continue;
            }


            if (position === "PROs" || position === "EMs") {
              // CASE 2A — PROs or EMs
              teamName = position;
            } else {
              // CASE 2B — ALL OTHER BE CORE POSTS GO UNDER "BE Core"
              teamName = "BE Core";
            }
          }

          // -------------------------------------------
          // Create user
          // -------------------------------------------
          const username = email.split('@')[0];
          const initialPassword = username;

          let user = await User.findOne({ email });

          if (!user) {
            user = new User({
              username,
              email,
              password: initialPassword,
              name,
              phone,
              year,
              division: dept,
              rollNo,
              initialPassword,
              role: "Head",
            });
          } else {
            user.username = username;
            user.name = name;
            user.phone = phone;
            user.year = year;
            user.division = dept;
            user.rollNo = rollNo;
            user.role = "Head";
            user.initialPassword = user.initialPassword || initialPassword;
          }

          await user.save(); // ensures user._id exists

          // -------------------------------------------
          // Create/update team
          // -------------------------------------------
          let team = await Team.findOne({ name: teamName });

          if (!team) {
            team = new Team({
              name: teamName,
              heads: [user._id],
            });
            await team.save();
            console.log(`🆕 Created team: ${teamName}`);
          } else {
            if (!team.heads.includes(user._id)) {
              team.heads.push(user._id);
              await team.save();
              console.log(`➕ Added head to team: ${teamName}`);
            }
          }

          // -------------------------------------------
          // Link team to user
          // -------------------------------------------
          if (!user.team.includes(team._id)) {
            user.team.push(team._id);
            await user.save();
          }

          console.log(`⭐ Imported: ${name} → ${teamName}`);
        }

        console.log("\n🎉 Core Team Import Done Successfully!");
      } catch (err) {
        console.error("❌ Error during import:", err);
      } finally {
        mongoose.connection.close();
      }
    });
})();
