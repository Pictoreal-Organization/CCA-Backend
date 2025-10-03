const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User, Team, Meeting, Task } = require('../models/index');
const bcrypt = require('bcrypt');

exports.createAdmin = async (req, res) => {
    try {
      const { username, email, password } = req.body;
  
      if (!username || !email || !password) {
        return res.status(400).json({ msg: "Username, email, and password are required" });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ msg: "Admin already exists" });
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      const admin = new User({
        username,
        email,
        password,
        role: 'Admin',
        initialPassword: password,
        passwordChanged: false
      });
  
      await admin.save();
  
      res.status(201).json({ msg: "Admin created successfully", adminId: admin._id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  
exports.adminCreateTeam = async (req, res) => {
  try {
    const { name, members = [], head = null } = req.body;

    if (!name) return res.status(400).json({ msg: "Team name is required" });

    const team = new Team({
      name,
      members, // Array of Member IDs
      head     // Head ID (optional)
    });

    await team.save();

    res.status(201).json({
      msg: "Team created successfully",
      team
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// exports.adminCreateMember = async (req, res) => {
//   try {
//     const { username, email, teamNames } = req.body; // pass team names

//     if (!username || !email || !Array.isArray(teamNames) || teamNames.length === 0)
//       return res.status(400).json({ msg: "Username, email, and teamNames are required" });

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ msg: "User already exists" });

//     // Create User
//     const user = new User({
//       username,
//       email,
//       role: 'Member',
//       password: username,
//       initialPassword: username,
//       passwordChanged: false
//     });
//     await user.save();

//     // Find teams by name
//     const teams = await Team.find({ name: { $in: teamNames } });
//     if (!teams.length) return res.status(404).json({ msg: "No matching teams found" });

//     const teamIds = teams.map(t => t._id);

//     // Create Member document
//     const member = new Member({
//       name: username,
//       email,
//       team: teamIds
//     });
//     await member.save();

//     // Update User reference
//     user.memberRef = member._id;
//     await user.save();

//     // Push Member into teams
//     await Team.updateMany({ _id: { $in: teamIds } }, { $push: { members: member._id } });

//     res.status(201).json({
//       msg: "Member created successfully",
//       userId: user._id,
//       memberId: member._id,
//       username: user.username,
//       email: user.email,
//       teams: teamNames,
//       password: user.username
//     });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

exports.adminCreateMember = async (req, res) => {
  try {
    const { username, email, teamIds } = req.body;

    if (!username || !email || !Array.isArray(teamIds) || teamIds.length === 0)
      return res.status(400).json({ msg: "Username, email, and teamIds are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    // Create Member User
    const user = new User({
      username,
      email,
      role: 'Member',
      password: username,
      initialPassword: username,
      passwordChanged: false,
      team: teamIds
    });

    await user.save();

    // Push user into each team's members array
    await Team.updateMany(
      { _id: { $in: teamIds } },
      { $addToSet: { members: user._id } } // $addToSet avoids duplicates
    );

    res.status(201).json({
      msg: "Member created successfully",
      userId: user._id,
      username: user.username,
      email: user.email,
      teams: teamIds,
      password: username
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// exports.adminCreateHead = async (req, res) => {
//   try {
//     const { username, email, teamNames } = req.body; // now passing names instead of IDs

//     if (!username || !email || !Array.isArray(teamNames) || teamNames.length === 0)
//       return res.status(400).json({ msg: "Username, email, and teamNames are required" });

//     const existingUser = await User.findOne({ email });
//     if (existingUser) return res.status(400).json({ msg: "User already exists" });

//     // Generate random password
//     const randomPassword = crypto.randomBytes(6).toString('hex');

//     // Create User
//     const user = new User({
//       username,
//       email,
//       role: 'Head',
//       password: username,
//       initialPassword: username,
//       passwordChanged: false
//     });

//     await user.save();

//     // Find Teams by names
//     const teams = await Team.find({ name: { $in: teamNames } });
//     if (!teams.length) return res.status(404).json({ msg: "No matching teams found" });

//     const teamIds = teams.map(t => t._id);

//     // Create Head document
//     const head = new Head({
//       name: username, 
//       team: teamIds
//     });
//     await head.save();

//     // Update User to reference Head
//     user.headRef = head._id;
//     await user.save();

//     // Push Head into Teams
//     await Team.updateMany(
//       { _id: { $in: teamIds } },
//       { $push: { heads: head._id } }
//     );

//     res.status(201).json({
//       msg: "Head created successfully",
//       userId: user._id,
//       headId: head._id,
//       username: user.username,
//       email: user.email,
//       teams: teamNames,
//       password: username
//     });

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

exports.adminCreateHead = async (req, res) => {
  try {
    const { username, email, teamIds } = req.body;

    if (!username || !email || !Array.isArray(teamIds) || teamIds.length === 0)
      return res.status(400).json({ msg: "Username, email, and teamIds are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    // Create Head User
    const user = new User({
      username,
      email,
      role: 'Head',
      password: username,
      initialPassword: username,
      passwordChanged: false,
      team: teamIds
    });

    await user.save();

    // Push user into each team's heads array
    await Team.updateMany(
      { _id: { $in: teamIds } },
      { $addToSet: { heads: user._id } } // $addToSet avoids duplicates
    );

    res.status(201).json({
      msg: "Head created successfully",
      userId: user._id,
      username: user.username,
      email: user.email,
      teams: teamIds,
      password: username
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// // ----------------------
// // Delete Member
// // ----------------------
// exports.deleteMember = async (req, res) => {
//   try {
//     const { memberId } = req.params;
//     const member = await Member.findByIdAndDelete(memberId);
//     if (!member) return res.status(404).json({ msg: "Member not found" });

//     // Remove reference from User
//     await User.findOneAndUpdate({ memberRef: memberId }, { memberRef: null });

//     res.json({ msg: "Member deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // ----------------------
// // Delete Head
// // ----------------------
// exports.deleteHead = async (req, res) => {
//   try {
//     const { headId } = req.params;
//     const head = await Head.findByIdAndDelete(headId);
//     if (!head) return res.status(404).json({ msg: "Head not found" });

//     // Remove reference from User
//     await User.findOneAndUpdate({ headRef: headId }, { headRef: null });

//     // Remove head from teams
//     await Team.updateMany({ head: headId }, { head: null });

//     res.json({ msg: "Head deleted successfully" });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);

    if (!user) return res.status(404).json({ msg: "User not found" });

    res.json({ msg: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ----------------------
// Update Head of Team
// ----------------------
exports.updateTeamHead = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { newHeadId } = req.body;

    const team = await Team.findByIdAndUpdate(
      teamId,
      { head: newHeadId },
      { new: true }
    ).populate('head');

    res.json({ msg: "Team head updated successfully", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// View All Members
// ----------------------
exports.getAllMembers = async (req, res) => {
  try {
    const members = await User.find({ role: 'Member' }).populate('team');
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// View All Heads
// ----------------------
exports.getAllHeads = async (req, res) => {
  try {
    const heads = await User.find({ role: 'Head' }).populate('team');
    res.json(heads);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// View All Teams
// ----------------------
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find().populate('members head meetings');
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// View All Meetings
// ----------------------
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('organizer team');
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// View All Tasks
// ----------------------
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().populate('team subtasks.assignedMembers');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// List Users with passwords (initial only)
// ----------------------
exports.getAllUsersForAdmin = async (req, res) => {
  try {
    const users = await User.find({}, 'username email role initialPassword passwordChanged');
    const formatted = users.map(u => ({
      username: u.username,
      email: u.email,
      role: u.role,
      password: u.passwordChanged ? "Hidden" : u.initialPassword
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
