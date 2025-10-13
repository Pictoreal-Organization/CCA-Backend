// controllers/team.controller.js
const { Team } = require('../models/index');

// Get all teams (populate members and heads)
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('members', 'username name email role year division')
      .populate('heads', 'username name email role year division');
    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get visible teams (exclude certain names)
exports.getVisibleTeams = async (req, res) => {
  try {
    const excludedNames = ["EMs", "PROs", "BE Core"];
    const teams = await Team.find({
      name: { $nin: excludedNames.map(name => new RegExp(`^${name}$`, 'i')) }
    })
      .populate('members', 'username name email role year division')
      .populate('heads', 'username name email role year division');

    res.status(200).json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single team by ID
exports.getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findById(teamId)
      .populate('members', 'username name email role year division')
      .populate('heads', 'username name email role year division');

    if (!team) return res.status(404).json({ msg: "Team not found" });

    res.status(200).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create a new team (Admin only)
exports.createTeam = async (req, res) => {
  try {
    const { name, members = [], heads = [] } = req.body;
    if (!name) return res.status(400).json({ msg: "Team name is required" });

    const team = new Team({ name, members, heads });
    await team.save();

    res.status(201).json({ msg: "Team created successfully", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update team head
exports.updateTeamHead = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { newHeadId } = req.body;

    const team = await Team.findByIdAndUpdate(
      teamId,
      { heads: [newHeadId] }, // Replace with new head
      { new: true }
    ).populate('heads', 'username name email role year division');

    if (!team) return res.status(404).json({ msg: "Team not found" });

    res.status(200).json({ msg: "Team head updated successfully", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add member(s) to team
exports.addMembersToTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ msg: "memberIds array required" });
    }

    const team = await Team.findByIdAndUpdate(
      teamId,
      { $addToSet: { members: { $each: memberIds } } },
      { new: true }
    ).populate('members', 'username name email role year division');

    if (!team) return res.status(404).json({ msg: "Team not found" });

    res.status(200).json({ msg: "Members added successfully", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Remove member from team
exports.removeMemberFromTeam = async (req, res) => {
  try {
    const { teamId, memberId } = req.params;

    const team = await Team.findByIdAndUpdate(
      teamId,
      { $pull: { members: memberId } },
      { new: true }
    ).populate('members', 'username name email role year division');

    if (!team) return res.status(404).json({ msg: "Team not found" });

    res.status(200).json({ msg: "Member removed successfully", team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
