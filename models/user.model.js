const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, unique: true, required: true, lowercase: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['Member', 'Head', 'Admin'], default: 'Member' },
  refreshToken: String,

  // Profile info
  name: String,
  rollNo: String,      // for members
  year: String,
  division: String,
  phone: String,

  // Relationships
  team: [{ type: Schema.Types.ObjectId, ref: 'Team' }],

  // Tracking
  tasksAssigned: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  eventsScheduled: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }],

  // Security
  initialPassword: { type: String },  
  passwordChanged: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = mongoose.model('User', userSchema);
