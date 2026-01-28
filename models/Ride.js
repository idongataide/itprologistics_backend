// models/Ride.js
const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DriverDetail',
    default: null
  },
  
  status: {
    type: String,
    enum: ['pending', 'searching', 'awaiting_driver_confirmation', 'accepted', 'picked_up', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  pickupLocation: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    }
  },
  
  destination: {
    address: {
      type: String,
      required: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    }
  },
  
  rideType: {
    type: String,
    enum: ['bicycle', 'motorcycle', 'car'],
    required: true
  },
  
  distance: {
    type: Number,
    required: true
  },
  
  estimatedDuration: {
    type: Number,
    required: true
  },
  
  baseFare: {
    type: Number,
    required: true
  },
  
  distanceFare: {
    type: Number,
    required: true
  },
  
  totalFare: {
    type: Number,
    required: true
  },
  
  paymentMethod: {
    type: String,
    enum: ['cash', 'online'],
    default: 'cash'
  },
  
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  
  instructions: {
    type: String,
    default: ''
  },
  
  riderRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  driverRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  
  feedback: {
    rider: String,
    driver: String
  },
  
  acceptedAt: {
    type: Date,
    default: null
  },
  
  arrivedAt: {
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
  }
}, {
  timestamps: true
});

RideSchema.index({ userId: 1, createdAt: -1 });
RideSchema.index({ driverId: 1, status: 1 });
RideSchema.index({ status: 1, createdAt: -1 });
RideSchema.index({ 'pickupLocation.coordinates': '2dsphere' });

module.exports = mongoose.model('Ride', RideSchema);