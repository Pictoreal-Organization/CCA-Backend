const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;

// Member Schema
const memberSchema = new Schema({
  name: String,
  rollNo: String,
  year: String,
  division: String
});

// Attendance Schema (optional, separate collection)
const attendanceSchema = new Schema({
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Excused'],
    default: 'Absent'
  },
  member: { type: Schema.Types.ObjectId, ref: 'Member' },
  meeting: { type: Schema.Types.ObjectId, ref: 'Meeting' }
});

// Subtask Schema
const subtaskSchema = new Schema({
  title: String,
  description: String,
  assignedMembers: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  }
});

// Task Schema
const taskSchema = new Schema({
  description: String,
  deadline: Date,
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  subtasks: [subtaskSchema]
});

const meetingSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  agenda: { type: String },
  dateTime: { type: Date, required: true },
  duration: { type: Number, default: 60 },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  location: { type: String, required: true },
  onlineLink: { type: String },

  // 🔗 Organizer is now a Member ref
  organizer: { type: Schema.Types.ObjectId, ref: 'Member', required: true },

  // 🔗 Team reference
  team: { type: Schema.Types.ObjectId, ref: 'Team', required: true },

  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  createdAt: { type: Date, default: Date.now }
});


// Head Schema
const headSchema = new Schema({
  name: String,
  team: { type: Schema.Types.ObjectId, ref: 'Team' },
  tasksAssigned: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  eventsScheduled: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }] // Was 'Event', changed to 'Meeting'
});

// Team Schema
const teamSchema = new Schema({
  name: String,
  members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
  meetings: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }], // Was 'events'
  head: { type: Schema.Types.ObjectId, ref: 'Head' }
});

// User Schema
const userSchema = new Schema({
  username: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Member', 'Head'],
    required: true
  },
  memberRef: {
    type: Schema.Types.ObjectId,
    ref: 'Member',
    required: function () { return this.role === 'Member'; }
  },
  headRef: {
    type: Schema.Types.ObjectId,
    ref: 'Head',
    required: function () { return this.role === 'Head'; }
  }
});

// Password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const saltRounds = 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (err) {
    next(err);
  }
});

// Password comparison method
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Models
const Member = mongoose.model('Member', memberSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Task = mongoose.model('Task', taskSchema);
const Meeting = mongoose.model('Meeting', meetingSchema);
const Head = mongoose.model('Head', headSchema);
const Team = mongoose.model('Team', teamSchema);
const User = mongoose.model('User', userSchema);

module.exports = {
  User,
  Member,
  Attendance,
  Task,
  Meeting,
  Head,
  Team
};
