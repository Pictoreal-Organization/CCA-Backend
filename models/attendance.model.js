const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Simplified Schema with only present and absent arrays
const attendanceSchema = new Schema({
  meeting: {
    type: Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
    unique: true
  },
  presentMembers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  absentMembers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);