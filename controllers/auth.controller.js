const { User } = require('../models/index');
const emailService = require('../services/email.service');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const user = new User({ username, email, password, role });
    await user.save();

    res.status(201).json({ msg: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('role');
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    res.json({ accessToken, refreshToken, role: user.role });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// exports.googleLogin = async (req, res) => {
//   const { token } = req.body; // The ID Token from Flutter

//   try {
//     // 1. Verify the token with Google
//     const ticket = await client.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });
    
//     const { email, name, picture } = ticket.getPayload();

//     // 2. Check if user exists in DB
//     let user = await User.findOne({ email });

//     if (!user) {
//       // ⛔ BLOCK: If email isn't in DB, reject login
//       return res.status(401).json({ 
//         msg: "Access Denied. This email is not registered with the club." 
//       });
//     }

//     // 3. (Optional) Update avatar/name if empty
//     if (!user.avatar) user.avatar = picture;
    
//     // 4. Generate Tokens
//     const accessToken = user.generateAccessToken();
//     const refreshToken = user.generateRefreshToken();

//     user.refreshToken = refreshToken;
//     await user.save();

//     res.json({ accessToken, refreshToken, role: user.role });

//   } catch (err) {
//     console.error("Google Auth Error:", err);
//     res.status(500).json({ msg: "Google Authentication Failed" });
//   }
// };

exports.googleLogin = async (req, res) => {
  const { token, isWeb } = req.body;

  try {
    let email, name, picture;

    if (isWeb) {
      // ✅ For web: Use access token to fetch user info
      console.log("🌐 Verifying web access token...");
      
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
      );
      
      if (!response.ok) {
        return res.status(401).json({ msg: "Invalid access token" });
      }
      
      const userInfo = await response.json();
      email = userInfo.email;
      name = userInfo.name;
      picture = userInfo.picture;
      
    } else {
      // ✅ For mobile: Verify ID token
      console.log("📱 Verifying mobile ID token...");
      
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    console.log(`✅ Authenticated user: ${email}`);

    // Check if user exists in DB
    let user = await User.findOne({ email }).populate('role');

    if (!user) {
      return res.status(401).json({ 
        msg: "Access Denied. This email is not registered with the club." 
      });
    }

    // Update avatar/name if empty
    if (!user.avatar && picture) user.avatar = picture;
    if (!user.username && name) user.username = name;
    
    // Generate Tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save();

    console.log(`✅ Login successful for ${email}`);
    res.json({ accessToken, refreshToken, role: user.role });

  } catch (err) {
    console.error("❌ Google Auth Error:", err);
    res.status(500).json({ msg: "Google Authentication Failed" });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ msg: 'No token provided' });

    const user = await User.findOne({ refreshToken: token });
    if (!user) return res.status(403).json({ msg: 'Invalid refresh token' });

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ msg: 'Token expired/invalid' });

      const newAccessToken = user.generateAccessToken();
      res.json({ accessToken: newAccessToken });
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findOne({ refreshToken: token });
    if (!user) return res.status(400).json({ msg: 'Invalid token' });

    user.refreshToken = null;
    await user.save();

    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

exports.requestPasswordChange = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await emailService.sendOtpEmail(user.email, otp);
    } catch (err) {
      return res.status(500).json({ msg: "Failed to send OTP email" });
    }

    res.json({ msg: "OTP sent to email" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ msg: "OTP not requested" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ msg: "Incorrect OTP" });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ msg: "OTP expired" });
    }

    return res.json({ msg: "OTP verified successfully" });
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

// exports.saveFcmToken = async (req, res) => {
//   try {
//     const { fcmToken } = req.body;
//     const userId = req.user.id;

//     if (!fcmToken) return res.status(400).json({ error: 'Token is required' });

//     // Add token to array using $addToSet (prevents duplicates)
//     await User.findByIdAndUpdate(userId, {
//       $addToSet: { fcmTokens: fcmToken }
//     });

//     res.status(200).json({ message: 'FCM Token saved' });
//   } catch (err) {
//     console.error("Error saving FCM token:", err);
//     res.status(500).json({ error: 'Failed to save token' });
//   }
// };


exports.saveFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user.id;

    if (!fcmToken) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Replace old tokens with the new one
    user.fcmTokens = [fcmToken];
    await user.save();

    res.status(200).json({ message: 'FCM Token updated' });
  } catch (err) {
    console.error("Error saving FCM token:", err);
    res.status(500).json({ error: 'Failed to save token' });
  }
};
