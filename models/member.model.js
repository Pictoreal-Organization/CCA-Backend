const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const memberSchema = new Schema({
  name: String,
  rollNo: String,
  year: String,
  division: String,
  email: { type: String, unique: true },
  phone: String,
  team: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
});

module.exports = mongoose.model('Member', memberSchema);
