// models/Notification.js

const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  type: {
    type: String,
    enum: [
      'order_created',
      'order_accepted',
      'order_in_progress',
      'order_completed',
      'order_cancelled',
      'driver_accepted',
      'vehicle_assigned',
      'admin_approval'
    ],
    required: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  message: {
    type: String,
    required: true
  },
  
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CharterOrder',
    default: null
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
  
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: {
    type: Date,
    default: null
  },
  
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for faster queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ orderId: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
