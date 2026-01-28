const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
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
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  totalTrips: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  driverRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },  
  verifiedAt: {
    type: Date
  },
  verificationNotes: {
    type: String,
    trim: true
  },
}, {
  timestamps: true
});


module.exports = mongoose.model('DriverDetail', driverSchema);