// routes/charterDriver.js
// Charter driver request routes

const express = require('express');
const router = express.Router();
const CharterOrder = require('../models/charter/CharterOrder');
const CharterDriver = require('../models/charter/CharterDriver');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// @route   GET /api/charter-driver/profile
// @desc    Get charter driver profile
// @access  Private (Charter Driver only)
router.get('/profile', auth, async (req, res) => {
  try {
    // Get the charter driver profile for the logged-in user
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id })
      .populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model year licensePlate color vehicleType capacity thumbnail status');

    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver profile not found'
      });
    }

    const user = charterDriver.userId;

    res.json({
      success: true,
      data: {
        _id: charterDriver._id,
        userId: charterDriver.userId._id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        licenseNumber: charterDriver.licenseNumber,
        experience: charterDriver.experience,
        languages: charterDriver.languages,
        rating: charterDriver.rating,
        totalTrips: charterDriver.totalTrips,
        status: charterDriver.status,
        vehicle: charterDriver.vehicleId ? {
          _id: charterDriver.vehicleId._id,
          make: charterDriver.vehicleId.make,
          model: charterDriver.vehicleId.model,
          year: charterDriver.vehicleId.year,
          licensePlate: charterDriver.vehicleId.licensePlate,
          color: charterDriver.vehicleId.color,
          vehicleType: charterDriver.vehicleId.vehicleType,
          capacity: charterDriver.vehicleId.capacity,
          thumbnail: charterDriver.vehicleId.thumbnail,
          status: charterDriver.vehicleId.status
        } : null,
        createdAt: charterDriver.createdAt,
        updatedAt: charterDriver.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching charter driver profile:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter driver profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter-driver/requests
// @desc    Get all charter requests sent to a specific driver
// @access  Private (Driver only)
router.get('/requests', auth, async (req, res) => {
  try {
    // Get the charter driver associated with the logged-in user
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });

    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver profile not found'
      });
    }

    // Find all orders assigned to this driver
    const requests = await CharterOrder.find({ driverId: charterDriver._id })
      .populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status')
      .sort({ createdAt: -1 });

    // Format the response to match frontend expectations
    const formattedRequests = requests.map(order => ({
      _id: order._id,
      driverId: charterDriver._id,
      pickupLocation: order.pickupLocation,
      destination: order.destination,
      tripDate: order.tripDate,
      tripTime: order.tripTime,
      passengers: order.passengers,
      specialRequests: order.specialRequests,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: {
        _id: order.userId._id,
        name: order.userId.fullname,
        email: order.userId.email,
        phone: order.userId.phone
      },
      vehicle: order.vehicleNeeded
    }));

    res.json({
      success: true,
      message: 'Charter requests fetched successfully',
      requests: formattedRequests
    });
  } catch (error) {
    console.error('Error fetching charter driver requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter-driver/requests/pending
// @desc    Get pending requests only
// @access  Private (Driver only)
router.get('/requests/pending', auth, async (req, res) => {
  try {
    // Get the charter driver associated with the logged-in user
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });

    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver profile not found'
      });
    }

    // Find pending orders assigned to this driver
    const requests = await CharterOrder.find({ 
      driverId: charterDriver._id, 
      status: 'pending' 
    })
      .populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status')
      .sort({ createdAt: -1 });

    // Format the response
    const formattedRequests = requests.map(order => ({
      _id: order._id,
      driverId: charterDriver._id,
      pickupLocation: order.pickupLocation,
      destination: order.destination,
      tripDate: order.tripDate,
      tripTime: order.tripTime,
      passengers: order.passengers,
      specialRequests: order.specialRequests,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: {
        _id: order.userId._id,
        name: order.userId.fullname,
        email: order.userId.email,
        phone: order.userId.phone
      },
      vehicle: order.vehicleNeeded
    }));

    res.json({
      success: true,
      message: 'Pending charter requests fetched successfully',
      requests: formattedRequests
    });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching pending requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter-driver/requests/:requestId
// @desc    Get a specific charter request
// @access  Private (Driver only)
router.get('/requests/:requestId', auth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const order = await CharterOrder.findById(requestId)
      .populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter request not found'
      });
    }

    // Verify the driver has access to this request
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });
    if (!charterDriver || order.driverId.toString() !== charterDriver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this request'
      });
    }

    const formattedRequest = {
      _id: order._id,
      driverId: charterDriver._id,
      pickupLocation: order.pickupLocation,
      destination: order.destination,
      tripDate: order.tripDate,
      tripTime: order.tripTime,
      passengers: order.passengers,
      specialRequests: order.specialRequests,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      user: {
        _id: order.userId._id,
        name: order.userId.fullname,
        email: order.userId.email,
        phone: order.userId.phone
      },
      vehicle: order.vehicleNeeded
    };

    res.json({
      success: true,
      message: 'Charter request fetched successfully',
      request: formattedRequest
    });
  } catch (error) {
    console.error('Error fetching charter request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/charter-driver/requests/:requestId/accept
// @desc    Accept a charter request
// @access  Private (Driver only)
router.put('/requests/:requestId/accept', auth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const order = await CharterOrder.findById(requestId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter request not found'
      });
    }

    // Verify the driver has access to this request
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });
    if (!charterDriver || order.driverId.toString() !== charterDriver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this request'
      });
    }

    // Update status to accepted
    order.status = 'accepted';
    order.acceptedAt = new Date();
    await order.save();

    const updatedOrder = await order.populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Charter request accepted successfully',
      request: updatedOrder
    });
  } catch (error) {
    console.error('Error accepting charter request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error accepting charter request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/charter-driver/requests/:requestId/reject
// @desc    Reject a charter request
// @access  Private (Driver only)
router.put('/requests/:requestId/reject', auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;

    const order = await CharterOrder.findById(requestId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter request not found'
      });
    }

    // Verify the driver has access to this request
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });
    if (!charterDriver || order.driverId.toString() !== charterDriver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this request'
      });
    }

    // Update status to cancelled
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelledBy = 'driver';
    order.cancellationReason = reason || 'Rejected by driver';
    await order.save();

    const updatedOrder = await order.populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Charter request rejected successfully',
      request: updatedOrder
    });
  } catch (error) {
    console.error('Error rejecting charter request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting charter request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/charter-driver/requests/:requestId/complete
// @desc    Complete a charter request
// @access  Private (Driver only)
router.put('/requests/:requestId/complete', auth, async (req, res) => {
  try {
    const { requestId } = req.params;

    const order = await CharterOrder.findById(requestId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter request not found'
      });
    }

    // Verify the driver has access to this request
    const charterDriver = await CharterDriver.findOne({ userId: req.user.id });
    if (!charterDriver || order.driverId.toString() !== charterDriver._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this request'
      });
    }

    // Update status to completed
    order.status = 'completed';
    order.completedAt = new Date();
    await order.save();

    const updatedOrder = await order.populate('userId', 'fullname email phone')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Charter request completed successfully',
      request: updatedOrder
    });
  } catch (error) {
    console.error('Error completing charter request:', error);
    res.status(500).json({
      success: false,
      message: 'Server error completing charter request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
