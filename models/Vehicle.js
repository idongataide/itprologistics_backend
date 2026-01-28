// models/Vehicle.js
const mongoose = require('mongoose');

const VehicleSchema = new mongoose.Schema({
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
    enum: ['sedan', 'suv', 'truck', 'van', 'motorcycle', 'bus', 'other']
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'maintenance', 'inactive'],
    default: 'available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vehicle', VehicleSchema);