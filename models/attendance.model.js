const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Excused'],
    default: 'Absent'
  },
  member: { type: Schema.Types.ObjectId, ref: 'Member' },
  meeting: { type: Schema.Types.ObjectId, ref: 'Meeting' }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
