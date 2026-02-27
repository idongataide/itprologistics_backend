// routes/charter.js
// Public charter booking routes for users

const express = require('express');
const router = express.Router();
const CharterOrder = require('../models/charter/CharterOrder');
const auth = require('../middleware/authMiddleware');

// @route   GET /api/charter/orders
// @desc    Get user's charter orders
// @access  Private
router.get('/orders', auth, async (req, res) => {
  try {
    const orders = await CharterOrder.find({ userId: req.user.id })
      .populate('driverId', 'licenseNumber experience languages')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching user charter orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/charter/book
// @desc    Create a new charter order
// @access  Private
router.post('/book', auth, async (req, res) => {
  try {
    const { pickupLocation, destination, vehicleNeeded, passengers, tripDate, tripTime, specialRequests } = req.body;

    // Validate required fields
    if (!pickupLocation || !destination || !vehicleNeeded || !tripDate || !tripTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: pickupLocation, destination, vehicleNeeded, tripDate, tripTime'
      });
    }

    const newOrder = new CharterOrder({
      userId: req.user.id,
      pickupLocation,
      destination,
      vehicleNeeded,
      passengers: passengers || 1,
      tripDate: new Date(tripDate),
      tripTime,
      specialRequests: specialRequests || '',
      status: 'pending'
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      message: 'Charter order created successfully',
      order: newOrder
    });
  } catch (error) {
    console.error('Error creating charter order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating charter order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
