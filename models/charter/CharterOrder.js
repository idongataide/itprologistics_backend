// models/charter/CharterOrder.js

const mongoose = require('mongoose');

const CharterOrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterDriver',
    default: null
  },
  
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterVehicle',
    default: null
  },
  
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  pickupLocation: {
    type: String,
    required: true
  },
  
  destination: {
    type: String,
    required: true
  },
  
  vehicleNeeded: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterVehicle',
    required: true
  },
  
  passengers: {
    type: Number,
    min: 1,
    max: 100,
    default: 1
  },
  
  tripDate: {
    type: Date,
    required: true
  },
  
  tripTime: {
    type: String,
    required: true
  },
  
  specialRequests: {
    type: String,
    default: ''
  },
  
  // Pricing fields (optional for now, can be expanded later)
  basePrice: {
    type: Number,
    default: 0
  },
  
  totalPrice: {
    type: Number,
    default: 0
  },
  
  // Payment information
  paymentMethod: {
    type: String,
    enum: ['cash', 'online', 'invoice'],
    default: 'cash'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  // Timestamps for status changes
  acceptedAt: {
    type: Date,
    default: null
  },
  
  startedAt: {
    type: Date,
    default: null
  },
  
  completedAt: {
    type: Date,
    default: null
  },
  
  cancelledAt: {
    type: Date,
    default: null
  },
  
  // Cancellation details
  cancellationReason: {
    type: String,
    default: null
  },
  
  cancelledBy: {
    type: String,
    enum: ['user', 'admin', 'driver', 'system'],
    default: null
  },
  
  // Feedback
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    comment: {
      type: String,
      default: ''
    }
  },
  
  // Admin notes
  adminNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries
CharterOrderSchema.index({ userId: 1, createdAt: -1 });
CharterOrderSchema.index({ driverId: 1, status: 1 });
CharterOrderSchema.index({ status: 1, createdAt: -1 });
CharterOrderSchema.index({ tripDate: 1, status: 1 });

module.exports = mongoose.model('CharterOrder', CharterOrderSchema);