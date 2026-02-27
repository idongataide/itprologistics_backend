// models/CharterDriver.js

const mongoose = require('mongoose');

const charterDriverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  licenseNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    street: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    zipCode: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      default: 'Nigeria',
      trim: true
    }
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterVehicle'
  },
  totalTrips: {
    type: Number,
    default: 0,
    min: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'suspended'],
    default: 'pending'
  },
  // Charter-specific fields
  experience: {
    type: Number,
    min: 0,
    default: 0,
    description: 'Years of experience'
  },
  specialLicenses: [{
    type: String,
    enum: ['passenger', 'hazardous', 'international', 'tour_guide']
  }],
  languages: [{
    type: String,
    trim: true
  }],
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  assignedCharters: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterBooking'
  }]
}, {
  timestamps: true
});

// Index for faster queries
charterDriverSchema.index({ userId: 1 });
charterDriverSchema.index({ status: 1 });
charterDriverSchema.index({ isVerified: 1 });
charterDriverSchema.index({ vehicleId: 1 });

module.exports = mongoose.model('CharterDriver', charterDriverSchema);