const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ msg: 'No token provided' });

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = user; // attach user info to request
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid or expired token' });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'Admin') return res.status(403).json({ msg: 'Admins only' });
  next();
};

// Admin or Head only middleware
const adminOrHeadOnly = (req, res, next) => {
  if (!['Admin', 'Head'].includes(req.user.role)) {
    return res.status(403).json({ msg: 'Admins or Heads only' });
  }
  next();
};

module.exports = { authMiddleware, adminOnly, adminOrHeadOnly };