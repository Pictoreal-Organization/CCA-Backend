const jwt = require('jsonwebtoken');
const { User } = require('../models/index');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ msg: 'No token provided' });

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('role').populate('tag');

    if (!user) return res.status(401).json({ msg: 'User not found' });

    req.user = user; // attach user info to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expired, please login again' });
    }
    res.status(401).json({ msg: 'Invalid token' });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role?.name !== 'Admin') return res.status(403).json({ msg: 'Admins only' });
  next();
};

// Admin or Head only middleware
const adminOrHeadOnly = (req, res, next) => {
  if (!['Admin', 'Head'].includes(req.user.role?.name)) {
    return res.status(403).json({ msg: 'Admins or Heads only' });
  }
  next();
};

const allowRoles = (...roles) => (req, res, next) => {
  // Check against role name or slug
  const userRole = req.user.role ? req.user.role.name : null;
  if (!roles.includes(userRole)) {
    return res.status(403).json({ msg: 'Access denied' });
  }
  next();
};

const checkPermission = (permission) => (req, res, next) => {
  const user = req.user;
  if (user.role && user.role.permissions && user.role.permissions.includes(permission)) {
    return next();
  }
  // Admins always have access? Or just rely on them having all permissions in DB?
  // Let's rely on DB permissions, but ensure Admin role has everything.
  // Exception: System admins might need bypass if permissions are missing.
  if (user.role && user.role.name === 'Admin') return next();

  return res.status(403).json({ msg: 'Access denied: Insufficient permissions' });
};

module.exports = { authMiddleware, adminOnly, adminOrHeadOnly, allowRoles, checkPermission };