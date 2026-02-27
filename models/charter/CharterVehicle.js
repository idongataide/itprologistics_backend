// models/CharterVehicle.js

const mongoose = require('mongoose');

const CharterVehicleSchema = new mongoose.Schema({
  make: {
    type: String,
    required: [true, 'Please add vehicle make'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Please add vehicle model'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, 'Please add vehicle year'],
    min: [1900, 'Year must be after 1900'],
    max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
  },
  licensePlate: {
    type: String,
    required: [true, 'Please add license plate'],
    unique: true,
    uppercase: true,
    trim: true
  },
  color: {
    type: String,
    required: [true, 'Please add vehicle color'],
    trim: true
  },
  vehicleType: {
    type: String,
    required: [true, 'Please add vehicle type'],
    enum: ['bicycle', 'motorcycle', 'car', 'suv', 'truck', 'van', 'bus', 'minibus', 'luxury']
  },
  thumbnail: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'maintenance', 'inactive'],
    default: 'available'
  },
  // Charter-specific fields
  capacity: {
    type: Number,
    required: [true, 'Please add passenger capacity'],
    min: [1, 'Capacity must be at least 1']
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterDriver',
    default: null
  }
}, {
  timestamps: true
});

// Add index for faster queries
CharterVehicleSchema.index({ status: 1, vehicleType: 1 });
CharterVehicleSchema.index({ licensePlate: 1 });

module.exports = mongoose.model('CharterVehicle', CharterVehicleSchema);