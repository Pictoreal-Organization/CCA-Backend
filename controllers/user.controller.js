const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models/index'); // User model

exports.updateUserProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ msg: "User not found" });

    const { name, rollNo, year, division, phone, avatar } = req.body;

    // Update allowed fields only if provided
    if (name) user.name = name;
    if (rollNo) user.rollNo = rollNo;
    if (year) user.year = year;
    if (division) user.division = division;
    if (phone) user.phone = phone;
    if (avatar) user.avatar = avatar; // ✅ avatar included here

    await user.save();

    res.json({
      msg: "Profile (including avatar) updated successfully",
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}, 'username name email rollNo role year division team avatar _id')
    .populate('team', 'name _id'); // ✅ Include team data
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getLoggedInUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) return res.status(401).json({ msg: 'Unauthorized: No user found' });

    // Re-fetch from DB to get latest data (optional)
    const freshUser = await User.findById(user._id)
      .select('-password -refreshToken -otp -otpExpiry')
      .populate('team', 'name _id'); // ✅ Populate team data

    if (!freshUser) return res.status(404).json({ msg: 'User not found' });

    res.json({ msg: 'User fetched successfully', user: freshUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.isBeCore = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ result: false, msg: "User not found" });

    // First check: Must be a Head
    if (user.role !== "Head") {
      return res.json({ result: false });
    }

    // Fetch latest user + populate teams
    const freshUser = await User.findById(user._id)
      .populate('team', 'name');

    if (!freshUser) return res.status(404).json({ result: false, msg: "User not found" });

    // Check if ANY team name is "beCore"
    const isBeCore = freshUser.team.some(t => t.name === "BE Core");

    return res.json({ result: isBeCore }); 
  } catch (err) {
    return res.status(500).json({ result: false, error: err.message });
  }
};


