const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const headSchema = new Schema({
  name: String,
  team: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
  tasksAssigned: [{ type: Schema.Types.ObjectId, ref: 'Task' }],
  eventsScheduled: [{ type: Schema.Types.ObjectId, ref: 'Meeting' }]
});

module.exports = mongoose.model('Head', headSchema);
