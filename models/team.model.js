const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
  name: { type: String, unique: true, required: true }, // make name unique and required
  members: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
  heads: [{ type: Schema.Types.ObjectId, ref: 'Head' }]
});

module.exports = mongoose.model('Team', teamSchema);
