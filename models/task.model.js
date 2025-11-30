const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Subtask Schema
const subtaskSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

// Task Schema
const taskSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  startDate: Date,
  deadline: Date,
  completedAt: { type: Date, default: null },
  team: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
  organizerTeam: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
  subtasks: [subtaskSchema]
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
