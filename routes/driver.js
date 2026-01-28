const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriverDetail = require('../models/AdminDriver');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const authMiddleware = require('../middleware/authMiddleware');

// GET /api/driver/profile - Get current driver's profile and vehicle
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // req.user.id should be set by authMiddleware (user's _id)
    const userId = req.user.id;
    // Find driver detail by userId
    const driver = await DriverDetail.findOne({ userId })
      .populate('userId', 'fullname email phone isActive')
      .populate('vehicleId');
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    // Compose response
    const user = driver.userId;
    const vehicle = driver.vehicleId;
    res.json({
      success: true,
      data: {
        _id: driver._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        driverId: driver._id,
        status: user.isActive ? 'active' : 'inactive',
        isVerified: !!user.isActive,
        createdAt: driver.createdAt,
        vehicle: vehicle ? {
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          licensePlate: vehicle.licensePlate,
          color: vehicle.color
        } : undefined
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

module.exports = router;
