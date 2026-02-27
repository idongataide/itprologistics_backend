// charterVehicle.js - Backend routes for Charter Vehicles

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Vehicle = require('../../../models/charter/CharterVehicle');
const CharterDriver = require('../../../models/charter/CharterDriver');
const auth = require('../../../middleware/authMiddleware');
const User = require('../../../models/User');

// Ensure upload directory exists
const uploadDir = 'uploads/charter-vehicles';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'charter-vehicle-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: fileFilter
});

// Admin verification middleware
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

// @route   POST /api/admin/charter/vehicles
// @desc    Create a new charter vehicle with thumbnail
// @access  Admin
router.post('/vehicles', auth, isAdmin, upload.single('thumbnail'), async (req, res) => {
  try {
    const { make, model, year, licensePlate, color, vehicleType, capacity, fuelType, features } = req.body;
    
    // Check if vehicle with same license plate exists
    const existingVehicle = await Vehicle.findOne({ licensePlate });
    if (existingVehicle) {
      // Delete uploaded file if vehicle creation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this license plate already exists'
      });
    }
    
    // Create thumbnail URL
    let thumbnailUrl = null;
    if (req.file) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/charter-vehicles/${req.file.filename}`;
    }
    
    // Parse features if it's a string
    let parsedFeatures = [];
    if (features) {
      try {
        parsedFeatures = JSON.parse(features);
      } catch (e) {
        parsedFeatures = features.split(',').map(f => f.trim());
      }
    }
    
    const vehicle = new Vehicle({
      make,
      model,
      year: parseInt(year),
      licensePlate: licensePlate.toUpperCase(),
      color,
      vehicleType,
      thumbnail: thumbnailUrl,
      capacity: capacity ? parseInt(capacity) : undefined,
      fuelType,
      features: parsedFeatures,
      status: 'available',
      isCharter: true // Custom field to identify charter vehicles
    });
    
    await vehicle.save();
    
    res.status(201).json({
      success: true,
      message: 'Charter vehicle created successfully',
      vehicle
    });
  } catch (error) {
    console.error('Error creating charter vehicle:', error);
    // Delete uploaded file if vehicle creation fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Server error creating charter vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/vehicles
// @desc    Get all charter vehicles
// @access  Admin
router.get('/vehicles', auth, isAdmin, async (req, res) => {
  try {
    const vehicles = await Vehicle.find({}).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      vehicles
    });
  } catch (error) {
    console.error('Error fetching charter vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/vehicles/available
// @desc    Get available charter vehicles for assignment
// @access  Admin
router.get('/vehicles/available', auth, isAdmin, async (req, res) => {
  try {
    const availableVehicles = await Vehicle.find({ 
      status: 'available',
    });
    
    res.json({
      success: true,
      availableVehicles
    });
  } catch (error) {
    console.error('Error fetching available charter vehicles:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available charter vehicles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/vehicles/:id
// @desc    Get single charter vehicle by ID
// @access  Admin
router.get('/vehicles/:id', auth, isAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ 
      _id: req.params.id,
      isCharter: true 
    });
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Charter vehicle not found'
      });
    }
    
    res.json({
      success: true,
      vehicle
    });
  } catch (error) {
    console.error('Error fetching charter vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/admin/charter/vehicles/:id
// @desc    Update charter vehicle
// @access  Admin
router.put('/vehicles/:id', auth, isAdmin, upload.single('thumbnail'), async (req, res) => {
  try {
    const { make, model, year, licensePlate, color, vehicleType, status, capacity, fuelType, features } = req.body;
    
    const vehicle = await Vehicle.findOne({ 
      _id: req.params.id,
      isCharter: true 
    });
    
    if (!vehicle) {
      // Delete uploaded file if vehicle not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Charter vehicle not found'
      });
    }
    
    // Check if license plate is being changed to one that already exists
    if (licensePlate && licensePlate !== vehicle.licensePlate) {
      const existingVehicle = await Vehicle.findOne({ 
        licensePlate: licensePlate.toUpperCase(),
        isCharter: true 
      });
      if (existingVehicle) {
        // Delete uploaded file if license plate exists
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this license plate already exists'
        });
      }
    }
    
    // Delete old thumbnail if new one is uploaded
    if (req.file && vehicle.thumbnail) {
      const oldThumbnailPath = path.join(__dirname, '../../..', vehicle.thumbnail.replace(/^.*\/uploads/, 'uploads'));
      if (fs.existsSync(oldThumbnailPath)) {
        fs.unlinkSync(oldThumbnailPath);
      }
    }
    
    // Create new thumbnail URL if file uploaded
    let thumbnailUrl = vehicle.thumbnail;
    if (req.file) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/charter-vehicles/${req.file.filename}`;
    }
    
    // Parse features if provided
    let parsedFeatures = vehicle.features;
    if (features) {
      try {
        parsedFeatures = JSON.parse(features);
      } catch (e) {
        parsedFeatures = features.split(',').map(f => f.trim());
      }
    }
    
    // Update vehicle
    vehicle.make = make || vehicle.make;
    vehicle.model = model || vehicle.model;
    vehicle.year = year ? parseInt(year) : vehicle.year;
    vehicle.licensePlate = licensePlate ? licensePlate.toUpperCase() : vehicle.licensePlate;
    vehicle.color = color || vehicle.color;
    vehicle.vehicleType = vehicleType || vehicle.vehicleType;
    vehicle.thumbnail = thumbnailUrl;
    vehicle.status = status || vehicle.status;
    vehicle.capacity = capacity ? parseInt(capacity) : vehicle.capacity;
    vehicle.fuelType = fuelType || vehicle.fuelType;
    vehicle.features = parsedFeatures;
    
    await vehicle.save();
    
    res.json({
      success: true,
      message: 'Charter vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Error updating charter vehicle:', error);
    // Delete uploaded file if update fails
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Server error updating charter vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/charter/vehicles/:id
// @desc    Delete charter vehicle
// @access  Admin
router.delete('/vehicles/:id', auth, isAdmin, async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({ 
      _id: req.params.id,
      isCharter: true 
    });
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Charter vehicle not found'
      });
    }
    
    // Check if vehicle is currently assigned to a charter driver
    const assignedDriver = await CharterDriver.findOne({ vehicleId: vehicle._id });
    if (assignedDriver) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle assigned to a charter driver. Unassign vehicle first.'
      });
    }
    
    // Delete thumbnail file if exists
    if (vehicle.thumbnail) {
      const thumbnailPath = path.join(__dirname, '../../..', vehicle.thumbnail.replace(/^.*\/uploads/, 'uploads'));
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    await vehicle.deleteOne();
    
    res.json({
      success: true,
      message: 'Charter vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting charter vehicle:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting charter vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/charter/drivers/:driverId/assign-vehicle
// @desc    Assign vehicle to charter driver
// @access  Admin
router.post('/drivers/:driverId/assign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    // Find charter driver
    let charterDriver = await CharterDriver.findOne({ userId: req.params.driverId });
    
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    // Check if driver already has a vehicle assigned
    if (charterDriver.vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Charter driver already has a vehicle assigned'
      });
    }
    
    // Find vehicle
    const vehicle = await Vehicle.findOne({ 
      _id: vehicleId,
      isCharter: true 
    });
    
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Charter vehicle not found'
      });
    }
    
    // Check if vehicle is available
    if (vehicle.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is not available for assignment'
      });
    }
    
    // Update charter driver
    charterDriver.vehicleId = vehicleId;
    await charterDriver.save();
    
    // Update vehicle status
    vehicle.status = 'assigned';
    await vehicle.save();
    
    // Populate charter driver details
    const populatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('vehicleId')
      .populate('userId', 'fullname email');
    
    res.json({
      success: true,
      message: 'Vehicle assigned to charter driver successfully',
      driver: populatedDriver
    });
  } catch (error) {
    console.error('Error assigning vehicle to charter driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error assigning vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/admin/charter/drivers/:driverId/unassign-vehicle
// @desc    Unassign vehicle from charter driver
// @access  Admin
router.post('/drivers/:driverId/unassign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    // Find charter driver
    let charterDriver = await CharterDriver.findOne({ userId: req.params.driverId });
    
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    // Check if driver has a vehicle assigned
    if (!charterDriver.vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Charter driver does not have a vehicle assigned'
      });
    }
    
    // Find vehicle
    const vehicle = await Vehicle.findById(charterDriver.vehicleId);
    
    if (vehicle && vehicle.isCharter) {
      // Update vehicle status
      vehicle.status = 'available';
      await vehicle.save();
    }
    
    // Remove vehicle from charter driver
    charterDriver.vehicleId = null;
    await charterDriver.save();
    
    res.json({
      success: true,
      message: 'Vehicle unassigned from charter driver successfully'
    });
  } catch (error) {
    console.error('Error unassigning vehicle from charter driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error unassigning vehicle',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/vehicles/stats/summary
// @desc    Get charter vehicle statistics
// @access  Admin
router.get('/vehicles/stats/summary', auth, isAdmin, async (req, res) => {
  try {
    const totalVehicles = await Vehicle.countDocuments({ isCharter: true });
    const availableVehicles = await Vehicle.countDocuments({ 
      isCharter: true, 
      status: 'available' 
    });
    const assignedVehicles = await Vehicle.countDocuments({ 
      isCharter: true, 
      status: 'assigned' 
    });
    const maintenanceVehicles = await Vehicle.countDocuments({ 
      isCharter: true, 
      status: 'maintenance' 
    });
    
    // Get vehicle type distribution
    const vehicleTypeDistribution = await Vehicle.aggregate([
      { $match: { isCharter: true } },
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        total: totalVehicles,
        available: availableVehicles,
        assigned: assignedVehicles,
        maintenance: maintenanceVehicles,
        byType: vehicleTypeDistribution
      }
    });
  } catch (error) {
    console.error('Error fetching charter vehicle stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching vehicle stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;