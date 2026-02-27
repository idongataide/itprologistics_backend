// routes/charterVehicles.js
// User-facing charter vehicle routes

const express = require('express');
const router = express.Router();
const CharterVehicle = require('../models/charter/CharterVehicle');
const CharterOrder = require('../models/charter/CharterOrder');
const auth = require('../middleware/authMiddleware');

// @route   GET /api/charter/vehicles/available
// @desc    Get all available charter vehicles
// @access  Private
router.get('/vehicles/available', auth, async (req, res) => {
  try {
    const availableVehicles = await CharterVehicle.find({ status: 'available' })
      .select('_id make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Available vehicles fetched successfully',
      availableVehicles: availableVehicles
    });
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter/vehicles/type/:vehicleType
// @desc    Get charter vehicles filtered by type
// @access  Private
router.get('/vehicles/type/:vehicleType', auth, async (req, res) => {
  try {
    const { vehicleType } = req.params;
    
    const vehicles = await CharterVehicle.find({ 
      vehicleType: vehicleType,
      status: 'available' 
    }).select('_id make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: `${vehicleType} vehicles fetched successfully`,
      vehicles: vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicles by type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles by type',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter/vehicles/capacity/:capacity
// @desc    Get charter vehicles filtered by capacity
// @access  Private
router.get('/vehicles/capacity/:capacity', auth, async (req, res) => {
  try {
    const { capacity } = req.params;
    
    const vehicles = await CharterVehicle.find({ 
      capacity: { $gte: parseInt(capacity) },
      status: 'available'
    }).select('_id make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Vehicles fetched successfully',
      vehicles: vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicles by capacity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles by capacity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter/vehicles/:vehicleId
// @desc    Get a specific charter vehicle by ID
// @access  Private
router.get('/vehicles/:vehicleId', auth, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    const vehicle = await CharterVehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({
      success: true,
      message: 'Vehicle fetched successfully',
      vehicle: vehicle
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/charter/vehicles/:vehicleId/availability
// @desc    Check vehicle availability for a specific date and time
// @access  Private
router.get('/vehicles/:vehicleId/availability', auth, async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Date and time are required'
      });
    }

    const vehicle = await CharterVehicle.findById(vehicleId);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        available: false,
        message: 'Vehicle not found'
      });
    }

    // Check for existing bookings on the specified date
    const existingBooking = await CharterOrder.findOne({
      vehicleId: vehicleId,
      pickupTime: {
        $gte: new Date(`${date}T00:00:00`),
        $lt: new Date(`${date}T23:59:59`)
      },
      status: { $in: ['pending', 'confirmed', 'in-progress'] }
    });

    const available = !existingBooking && vehicle.status === 'available';

    res.json({
      success: true,
      available: available,
      message: available ? 'Vehicle is available' : 'Vehicle is not available'
    });
  } catch (error) {
    console.error('Error checking vehicle availability:', error);
    res.status(500).json({
      success: false,
      available: false,
      message: 'Failed to check availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/charter/vehicles/filter
// @desc    Get vehicles with specific features
// @access  Private
router.post('/vehicles/filter', auth, async (req, res) => {
  try {
    const { features } = req.body;

    if (!features || !Array.isArray(features)) {
      return res.status(400).json({
        success: false,
        message: 'Features array is required'
      });
    }

    const vehicles = await CharterVehicle.find({
      features: { $in: features },
      status: 'available'
    }).select('_id make model year licensePlate color vehicleType capacity thumbnail features fuelType status');

    res.json({
      success: true,
      message: 'Vehicles fetched successfully',
      vehicles: vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicles by features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
