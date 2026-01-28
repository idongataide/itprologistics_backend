// vehicles.js - Backend routes

const express = require('express');
const router = express.Router();
const Vehicle = require('../../models/Vehicle');
const DriverDetail = require('../../models/AdminDriver');
const auth = require('../../middleware/authMiddleware');
const User = require('../../models/User');

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied: Admin only'
      });
    }
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in admin verification'
    });
  }
};

router.post('/admin/vehicles', auth, isAdmin, async (req, res) => {
  try {
    const { make, model, year, licensePlate, color, vehicleType } = req.body;
    
    // Check if vehicle with same license plate exists
    const existingVehicle = await Vehicle.findOne({ licensePlate });
    if (existingVehicle) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this license plate already exists'
      });
    }
    
    const vehicle = new Vehicle({
      make,
      model,
      year,
      licensePlate,
      color,
      vehicleType,
      status: 'available'
    });
    
    await vehicle.save();
    
    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      vehicle
    });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/vehicles
// @desc    Get all vehicles
// @access  Admin
router.get('/admin/vehicles', auth, isAdmin, async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      vehicles
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/vehicles/available
// @desc    Get available vehicles for assignment
// @access  Admin
router.get('/admin/vehicles/available', auth, isAdmin, async (req, res) => {
  try {
    const availableVehicles = await Vehicle.find({ status: 'available' });
    
    res.json({
      success: true,
      availableVehicles
    });
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/vehicles/:id
// @desc    Get single vehicle by ID
// @access  Admin
router.get('/admin/vehicles/:id', auth, isAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    res.json({
      success: true,
      vehicle
    });
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/vehicles/:id
// @desc    Update vehicle
// @access  Admin
router.put('/admin/vehicles/:id', auth, isAdmin, async (req, res) => {
  try {
    const { make, model, year, licensePlate, color, vehicleType, status } = req.body;
    
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if license plate is being changed to one that already exists
    if (licensePlate && licensePlate !== vehicle.licensePlate) {
      const existingVehicle = await Vehicle.findOne({ licensePlate });
      if (existingVehicle) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this license plate already exists'
        });
      }
    }
    
    // Update vehicle
    vehicle.make = make || vehicle.make;
    vehicle.model = model || vehicle.model;
    vehicle.year = year || vehicle.year;
    vehicle.licensePlate = licensePlate || vehicle.licensePlate;
    vehicle.color = color || vehicle.color;
    vehicle.vehicleType = vehicleType || vehicle.vehicleType;
    vehicle.status = status || vehicle.status;
    
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Error updating vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/vehicles/:id
// @desc    Delete vehicle
// @access  Admin
router.delete('/admin/vehicles/:id', auth, isAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if vehicle is currently assigned to a driver
    const assignedDriver = await DriverDetail.findOne({ vehicleId: vehicle._id });
    if (assignedDriver) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle assigned to a driver. Unassign vehicle first.'
      });
    }
    
    await vehicle.deleteOne();
    
    res.json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/drivers/:driverId/assign-vehicle
// @desc    Assign vehicle to driver
// @access  Admin
router.post('/admin/drivers/:driverId/assign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    // Find driver details
    let driverDetail = await DriverDetail.findOne({ userId: req.params.driverId });
    
    if (!driverDetail) {
      return res.status(404).json({
        success: false,
        message: 'Driver details not found'
      });
    }
    
    // Check if driver already has a vehicle assigned
    if (driverDetail.vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Driver already has a vehicle assigned'
      });
    }
    
    // Find vehicle
    const vehicle = await Vehicle.findById(vehicleId);
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if vehicle is available
    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available for assignment'
      });
    }
    
    // Update driver details
    driverDetail.vehicleId = vehicleId;
    await driverDetail.save();
    
    // Update vehicle status
    vehicle.status = 'assigned';
    await vehicle.save();
    
    // Populate driver details
    const populatedDriver = await DriverDetail.findById(driverDetail._id)
      .populate('vehicleId', 'make model licensePlate color vehicleType')
      .populate('userId', 'fullname email');
    
    res.json({
      success: true,
      message: 'Vehicle assigned successfully',
      driver: populatedDriver
    });
  } catch (error) {
    console.error('Error assigning vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/drivers/:driverId/unassign-vehicle
// @desc    Unassign vehicle from driver
// @access  Admin
router.post('/admin/drivers/:driverId/unassign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    // Find driver details
    let driverDetail = await DriverDetail.findOne({ userId: req.params.driverId });
    
    if (!driverDetail) {
      return res.status(404).json({
        success: false,
        message: 'Driver details not found'
      });
    }
    
    // Check if driver has a vehicle assigned
    if (!driverDetail.vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Driver does not have a vehicle assigned'
      });
    }
    
    // Find vehicle
    const vehicle = await Vehicle.findById(driverDetail.vehicleId);
    
    if (vehicle) {
      // Update vehicle status
      vehicle.status = 'available';
      await vehicle.save();
    }
    
    // Remove vehicle from driver
    driverDetail.vehicleId = null;
    await driverDetail.save();
    
    res.json({
      success: true,
      message: 'Vehicle unassigned successfully'
    });
  } catch (error) {
    console.error('Error unassigning vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unassigning vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;