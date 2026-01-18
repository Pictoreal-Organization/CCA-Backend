const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roleSchema = new Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true, 
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  permissions: [{
    type: String
  }],
  isSystem: { // System roles cannot be deleted
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', roleSchema);
