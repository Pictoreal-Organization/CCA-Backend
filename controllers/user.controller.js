const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models/index'); // User model

exports.requestPasswordChange = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: user.email,
    //   subject: "OTP for Password Change",
    //   text: `Your OTP for password change is: ${otp}`
    // });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: "OTP for Password Change",
        text: `Your OTP for password change is: ${otp}`
      });
    } catch (err) {
      return res.status(500).json({ msg: "Failed to send OTP email" });
    }    

    res.json({ msg: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePasswordWithOTP = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (user.otp !== otp || new Date() > user.otpExpiry) {
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    // Update password
    user.password = newPassword; // will be hashed in pre-save
    user.passwordChanged = true;
    user.initialPassword = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;

    await user.save();

    res.json({ msg: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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
    const users = await User.find({}, 'username name email role year division initialPassword');
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
      .select('-password -refreshToken -otp -otpExpiry'); // exclude sensitive info

    if (!freshUser) return res.status(404).json({ msg: 'User not found' });

    res.json({ msg: 'User fetched successfully', user: freshUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


