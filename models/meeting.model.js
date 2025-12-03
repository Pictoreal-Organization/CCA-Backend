const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const meetingSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  agenda: { type: String },
  
  // ✅ Both are required now
  dateTime: { type: Date, required: true }, 
  endTime: { type: Date, required: true },
  
  // ✅ Calculated automatically
  duration: { type: Number, default: 0 }, 

  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  location: { type: String, required: function() { return !this.onlineLink; }, default: null },
  onlineLink: { type: String, default: null, required: function() { return !this.location; } },
  organizer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  team: [{ type: Schema.Types.ObjectId, ref: 'Team', default: null }],
  status: {
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  tags: { type: [String], default: [] },
  isPrivate: { type: Boolean, default: false },
  invitedMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  // ✅ NEW: Core type field
  coreType: { 
    type: String, 
    enum: ['entire', 'be', 'te', null],
    default: null 
  },

  createdAt: { type: Date, default: Date.now }
});

// ✅ Pre-save hook to calculate duration automatically
meetingSchema.pre('save', function(next) {
  if (this.dateTime && this.endTime) {
    const diffMs = this.endTime - this.dateTime; // Difference in milliseconds
    this.duration = Math.floor(diffMs / 60000); // Convert to minutes
  }
  next();
});

// ✅ Pre-update hook (for findByIdAndUpdate)
meetingSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.dateTime && update.endTime) {
    const start = new Date(update.dateTime);
    const end = new Date(update.endTime);
    const diffMs = end - start;
    update.duration = Math.floor(diffMs / 60000);
  }
  next();
});

module.exports = mongoose.model('Meeting', meetingSchema);