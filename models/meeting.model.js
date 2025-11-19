const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
  location: { type: String, required: function() { return !this.onlineLink; }, default: null },
  onlineLink: { type: String, default: null, required: function() { return !this.location; } },
  organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  team: [{ type: Schema.Types.ObjectId, ref: 'Team', default: null }], // optional
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  tags: {
    type: [String], // multiple tags possible
    // enum: ['General', 'Impactathon', 'PictoFest', 'BDD'], // define your enums here
    default: []
  },
  isPrivate: { type: Boolean, default: false }, // private or public meeting
  invitedMembers: [
    { type: Schema.Types.ObjectId, ref: 'User' } // array of user IDs
  ],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Meeting', meetingSchema);

