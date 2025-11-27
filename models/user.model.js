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
  avatar: { type: String, default: "" },

  // Relationships
  team: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  fcmTokens: [{ type: String }],

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
    { expiresIn: '90d' }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, email: this.email },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '90d' }
  );
};

userSchema.pre('findOneAndDelete', async function (next) {
  try {
    const user = await this.model.findOne(this.getFilter());
    if (!user) return next();

    // Import Team model here to avoid circular import issues
    const Team = require('./team.model');

    if (Array.isArray(user.team) && user.team.length > 0) {
      for (const teamId of user.team) {
        if (user.role === 'Member') {
          await Team.findByIdAndUpdate(
            teamId,
            { $pull: { members: user._id } }
          );
        } else if (user.role === 'Head') {
          await Team.findByIdAndUpdate(
            teamId,
            { $pull: { heads: user._id } }
          );
        }
      }
    }

    next();
  } catch (err) {
    console.error('Error in user cleanup hook:', err);
    next(err);
  }
});


module.exports = mongoose.model('User', userSchema);
