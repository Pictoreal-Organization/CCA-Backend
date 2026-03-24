const axios = require('axios');
const { Readable } = require('stream');
const csv = require('csv-parser');
const { User, Team, Meeting, Task, Role } = require('../models/index');
const bcrypt = require('bcrypt');

exports.createAdmin = async (req, res) => {
    try {
      const { username, email, password } = req.body;
  
      if (!username || !email || !password) {
        return res.status(400).json({ msg: "Username, email, and password are required" });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ msg: "Admin already exists" });
  
      const role = await Role.findOne({ slug: 'admin' });
      if (!role) return res.status(500).json({ msg: "Admin Role not found in DB" });

      const hashedPassword = await bcrypt.hash(password, 10);
  
      const admin = new User({
        username,
        email,
        password,
        role: role._id,
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

exports.adminCreateMember = async (req, res) => {
  try {
    const {
      username,
      email,
      name,
      rollNo,
      year,
      division,
      phone,
      teamIds
    } = req.body;

    if (!username || !email || !Array.isArray(teamIds) || teamIds.length === 0)
      return res.status(400).json({ msg: "Username, email, and teamIds are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    const role = await Role.findOne({ slug: 'member' });
    if (!role) return res.status(500).json({ msg: "Member Role not found in DB" });

    // Create Member User
    const user = new User({
      username,
      email,
      name,
      rollNo,
      year,
      division,
      phone,
      role: role._id,
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
      name: user.name,
      rollNo: user.rollNo,
      year: user.year,
      division: user.division,
      phone: user.phone,
      teams: teamIds,
      password: username
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adminCreateHead = async (req, res) => {
  try {
    const { username, email, name, teamIds } = req.body;

    if (!username || !email || !Array.isArray(teamIds) || teamIds.length === 0)
      return res.status(400).json({ msg: "Username, email, and teamIds are required" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: "User already exists" });

    // Use Head role OR Coordinator role. Assuming 'Head' = 'Coordinator' in new system or separate?
    // User said "Coordinator logic", but 'Head' exists in logs. Let's assume 'head' slug exists or map to 'coordinator'.
    // Actually, earlier seeding created 'admin' and 'coordinator'. Is there a 'head' role?
    // Let's use 'coordinator' for heads if 'head' role doesn't exist, OR strictly 'head'.
    // Given 'Coordinator' tag constraints, 'Head' might be mapped to 'Coordinator'.
    // Checking setup_test_data.js... it used 'coordinator'.
    // Checking importCoreTeam.js... it used 'Head'.
    // I should check Role collection for 'head'. If not found, use 'coordinator'.

    let role = await Role.findOne({ slug: 'head' });
    if (!role) role = await Role.findOne({ slug: 'coordinator' });
    if (!role) return res.status(500).json({ msg: "Head/Coordinator Role not found" });

    // Create Head User
    const user = new User({
      username,
      email,
      role: role._id, // Assign obtained role ID
      name: name ? name : "",
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

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const userToDelete = await User.findById(userId).populate('role');
    if (!userToDelete) return res.status(404).json({ msg: "User not found" });

    // Protect Admin Role
    if (userToDelete.role && (userToDelete.role.name === 'Admin' || userToDelete.role === 'Admin')) {
        return res.status(403).json({ msg: "Cannot delete an Admin user." });
    }

    const deletedUser = await User.findOneAndDelete({ _id: userId });
    
    res.json({ msg: `User deleted successfully and removed from teams.`});
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: err.message });
  }
};

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

exports.getAllMembers = async (req, res) => {
  try {
    const role = await Role.findOne({ slug: 'member' });
    const query = role ? { role: role._id } : { role: 'Member' }; // Fallback if role is mixed

    const members = await User.find(query).populate('team').populate('role');
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllHeads = async (req, res) => {
  try {
    // Try to find Head role, or Coordinator role
    // This logic might need refinement depending on strict requirements
    const headRole = await Role.findOne({ slug: 'head' });
    const coordRole = await Role.findOne({ slug: 'coordinator' });
    
    // Construct query to find users with either role
    const roleIds = [];
    if (headRole) roleIds.push(headRole._id);
    if (coordRole) roleIds.push(coordRole._id);

    const query = roleIds.length > 0 ? { role: { $in: roleIds } } : { role: 'Head' };

    const users = await User.find(query).populate('team').populate('role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('members')
      .populate('heads');
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getVisibleTeams = async (req, res) => {
  try {
    const excludedNames = ["EMs", "PROs", "BE Core"];
    const teams = await Team.find({
      name: { $nin: excludedNames.map(name => new RegExp(`^${name}$`, 'i')) }
    })
      .populate('members')
      .populate('heads');

    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('organizer team tags');
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().populate('team subtasks.assignedTo tags');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllUsersForAdmin = async (req, res) => {
  try {
    const users = await User.find({}, 'username name email role year division initialPassword passwordChanged rollNo team tag')
                            .populate('role') // Populate role for name access
                            .populate('team') // Populate team for display
                            .populate('tag'); // Populate tag for Coordinators

    const formatted = users.map(u => ({
      _id: u._id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role?.name || u.role, // Handle Object or String
      team: u.team, // Pass populated team array/object
      tag: u.tag, // Pass populated tag
      password: u.passwordChanged ? "Hidden" : u.initialPassword,
      year: u.year,
      division: u.division,
      rollNo: u.rollNo
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSingleMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await User.findById(id).populate('team').populate('role').populate('tag'); // Added populate tag
    if (!member) return res.status(404).json({ msg: "Member not found" });

    res.json(member);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch old member info
    const oldMember = await User.findById(id).populate('role');
    if (!oldMember) return res.status(404).json({ msg: "Member not found" });

    // Protect Admin Role
    if (oldMember.role && (oldMember.role.name === 'Admin' || oldMember.role === 'Admin')) {
        return res.status(403).json({ msg: "Cannot edit an Admin user." });
    }

    const oldTeams = oldMember.team || [];
    const newTeams = updates.team || [];

    // STEP 1: Update user fields normally
    const updatedMember = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    // STEP 2: Remove member from teams that they are no longer part of
    await Team.updateMany(
      { _id: { $in: oldTeams } },
      { $pull: { members: id } }
    );

    // STEP 3: Add member to new teams
    await Team.updateMany(
      { _id: { $in: newTeams } },
      { $addToSet: { members: id } }
    );

    res.json({
      msg: "Member updated successfully",
      user: updatedMember
    });

  } catch (err) {
    console.error("Update Member Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// In-memory store for sync status (fine for single-instance servers)
const syncStatus = {
  running: false,
  lastRun: null,
  result: null,
  error: null
};

// Extracted sync logic (no req/res — runs in background)
async function doSyncWork() {
  const SHEET_ID = '1m93qxzXLo1bS1Oo29WzOU0nVQCUq2wyFvN6X48Z_MRQ';
  const GID = '1763042882';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  const summary = { added: [], updated: [], skipped: [], errors: [] };

  const response = await axios.get(csvUrl, { responseType: 'arraybuffer' });
  const csvString = Buffer.from(response.data).toString('utf-8');

  const results = await new Promise((resolve, reject) => {
    const rows = [];
    Readable.from(csvString)
      .pipe(csv())
      .on('data', (d) => rows.push(d))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

  const memberRole = await Role.findOne({ slug: 'member' });
  if (!memberRole) throw new Error('Member role not found in DB');

  const getField = (row, keyword) => {
    const key = Object.keys(row).find(k =>
      k.toLowerCase().replace(/\s+/g, ' ').trim().includes(keyword.toLowerCase())
    );
    return key ? row[key]?.trim() : undefined;
  };

  const allTeamDocs = await Team.find({});
  const teamCache = new Map(allTeamDocs.map(t => [t.name.toLowerCase(), t]));

  const getOrCreateTeam = async (teamName) => {
    const key = teamName.toLowerCase();
    if (teamCache.has(key)) return teamCache.get(key);
    const newTeam = await Team.create({ name: teamName });
    teamCache.set(key, newTeam);
    return newTeam;
  };

  const emails = results.map(row => getField(row, 'email')?.toLowerCase()).filter(Boolean);
  const existingUsers = await User.find({ email: { $in: emails } });
  const userCache = new Map(existingUsers.map(u => [u.email, u]));

  for (const row of results) {
    const email = getField(row, 'email')?.toLowerCase();
    if (!email) { summary.skipped.push({ reason: 'Missing email' }); continue; }

    try {
      const name       = getField(row, 'name');
      const phone      = getField(row, 'mobile')?.replace(/\D/g, '');
      const rollNo     = getField(row, 'roll');
      const year       = getField(row, 'year');
      const department = getField(row, 'department');

      const teams1 = getField(row, 'select one or more')?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const teams2 = getField(row, 'select other')?.split(',').map(t => t.trim()).filter(Boolean) || [];
      const allTeams = [...new Set([...teams1, ...teams2])];

      const username = email.split('@')[0];
      let user  = userCache.get(email);
      let isNew = false;

      if (user) {
        user.username = username;
        user.name     = name       || user.name;
        user.rollNo   = rollNo     || user.rollNo;
        user.year     = year       || user.year;
        user.division = department || user.division;
        user.phone    = phone      || user.phone;
        user.role     = memberRole._id;
        if (!user.initialPassword) user.initialPassword = username;
      } else {
        isNew = true;
        user = new User({
          username, email,
          password: username, name, rollNo, year,
          division: department, phone,
          initialPassword: username,
          passwordChanged: false,
          role: memberRole._id,
          fcmTokens: [], team: [],
        });
      }

      await user.save();

      const teamDocs = await Promise.all(allTeams.map(getOrCreateTeam));
      await Promise.all(teamDocs.map(team =>
        Team.updateOne({ _id: team._id }, { $addToSet: { members: user._id } })
      ));

      const existingTeamIds = user.team.map(String);
      for (const team of teamDocs) {
        if (!existingTeamIds.includes(String(team._id))) user.team.push(team._id);
      }
      await user.save();

      if (isNew) summary.added.push(email);
      else summary.updated.push(email);

    } catch (rowErr) {
      summary.errors.push({ email, error: rowErr.message });
    }
  }

  return summary;
}

// POST /admin/sync-members-from-sheet — triggers sync, returns immediately
exports.syncMembersFromSheet = async (req, res) => {
  if (syncStatus.running) {
    return res.status(409).json({ msg: 'Sync already in progress. Check /sync-status for updates.' });
  }

  syncStatus.running = true;
  syncStatus.result  = null;
  syncStatus.error   = null;

  // Respond immediately — don't await the work
  res.json({ msg: 'Sync started', status: 'running' });

  // Fire and forget
  doSyncWork()
    .then(summary => {
      syncStatus.running = false;
      syncStatus.lastRun = new Date().toISOString();
      syncStatus.result  = summary;
      console.log('✅ Sheet sync complete:', summary.added.length, 'added,', summary.updated.length, 'updated');
    })
    .catch(err => {
      syncStatus.running = false;
      syncStatus.error   = err.message;
      console.error('❌ Sheet sync failed:', err.message);
    });
};

// GET /admin/sync-status — frontend polls this
exports.getSyncStatus = (req, res) => {
  res.json(syncStatus);
};