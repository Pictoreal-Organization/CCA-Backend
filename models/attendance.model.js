const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
  status: {
    type: String,
    enum: ['present', 'absent', 'excused'],
    default: 'absent'
  },
  member: { type: Schema.Types.ObjectId, ref: 'User' },
  meeting: { type: Schema.Types.ObjectId, ref: 'Meeting' }
});

module.exports = mongoose.model('Attendance', attendanceSchema);
