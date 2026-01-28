// routes/driver.js
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const DriverDetail = require('../../models/AdminDriver');
const User = require('../../models/User');
const Vehicle = require('../../models/Vehicle'); // You'll need to create this model

// Optional: Admin middleware for admin-only routes
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


// GET /api/admin/drivers - Get all drivers
router.get('/admin/drivers/', auth, async (req, res) => {
  try {
    console.log('Fetching all drivers');
    
    // Get requesting user (must be admin)
    const adminUser = await User.findById(req.user.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }
    
    // First, get all users with driver role
    const driverUsers = await User.find({ role: 'driver' })
      .select('-password -__v')
      .sort({ createdAt: -1 });
    
    // Get driver details for these users
    const driverDetails = await DriverDetail.find({})
      .populate('userId', 'fullname email phone role isActive createdAt')
      .populate('vehicleId', 'make model year licensePlate color vehicleType status');
    
    // Create a map for quick lookup
    const detailsMap = {};
    driverDetails.forEach(detail => {
      if (detail.userId) {
        detailsMap[detail.userId._id.toString()] = detail;
      }
    });
    
    // Combine user info with driver details
    const drivers = driverUsers.map(user => {
      const driverDetail = detailsMap[user._id.toString()];
      
      return {
        id: user._id,
        userId: user._id,
        name: user.fullname,
        email: user.email,
        phone: user.phone,
        userStatus: user.isActive ? 'active' : 'inactive',
        role: user.role,
        createdAt: user.createdAt,
        // Driver details (if exists)
        driverId: driverDetail?._id,
        driverStatus: user.isActive ? 'active' : 'inactive',
        licenseNumber: driverDetail?.licenseNumber,
        address: driverDetail?.address,
        vehicle: driverDetail?.vehicleId,
        isVerified: driverDetail?.isVerified || false,
        verifiedAt: driverDetail?.verifiedAt,
        totalTrips: driverDetail?.totalTrips || 0,
        totalEarnings: driverDetail?.totalEarnings || 0,
        driverRating: driverDetail?.driverRating || 0,
        hasDriverDetails: !!driverDetail
      };
    });
    
    console.log(`Found ${drivers.length} driver users`);
    
    // Get stats
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.driverStatus === 'active').length;
    const pendingDrivers = drivers.filter(d => d.driverStatus === 'pending').length;
    const verifiedDrivers = drivers.filter(d => d.isVerified).length;
    const driversWithVehicles = drivers.filter(d => d.vehicle).length;
    
    res.json({
      success: true,
      drivers,
      count: drivers.length,
      stats: {
        totalDrivers,
        activeDrivers,
        pendingDrivers,
        verifiedDrivers,
        driversWithVehicles
      }
    });
    
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// GET /api/drivers/:id - Get single driver by ID
router.get('/admin/drivers/:id', auth, async (req, res) => {
  try {
    const driver = await DriverDetail.findById(req.params.id)
      .populate('userId', 'fullname email phone role isActive createdAt')
      .populate('vehicleId', 'make model year licensePlate color vehicleType status');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Check permissions: Admins can see all, drivers can only see themselves
    if (req.user?.role !== 'admin' && driver.userId._id.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      driver
    });
    
  } catch (error) {
    console.error('Error fetching driver:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error fetching driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/drivers/details - Create driver details for existing user
router.post('/admin/drivers/details', auth, async (req, res) => {
  try {
    const { userId, licenseNumber, address } = req.body;
    
    console.log('Creating driver details for user:', userId);
    
    // Validate required fields
    if (!userId || !licenseNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'User ID, license number, and address are required'
      });
    }
    
    // Check if user exists and has driver role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role !== 'driver') {
      return res.status(400).json({
        success: false,
        message: 'User must have driver role'
      });
    }
    
    // Check if driver details already exist
    const existingDriver = await DriverDetail.findOne({ userId });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Driver details already exist for this user'
      });
    }
    
    // Check if license number is unique
    const existingLicense = await DriverDetail.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({
        success: false,
        message: 'License number already in use'
      });
    }
    
    // Create driver details
    const driverDetail = new DriverDetail({
      userId,
      licenseNumber,
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || 'Nigeria'
      }
    });
    
    await driverDetail.save();
    
    // Populate and return
    const populatedDriver = await DriverDetail.findById(driverDetail._id)
      .populate('userId', 'fullname email phone role isActive');
    
    res.status(201).json({
      success: true,
      message: 'Driver details created successfully',
      driver: populatedDriver
    });
    
  } catch (error) {
    console.error('Error creating driver details:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate key error'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error creating driver details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/drivers/:id - Update driver details
router.put('/admin/drivers/:id', auth, async (req, res) => {
  try {
    const { licenseNumber, address, status } = req.body;
    
    // Find driver
    let driver = await DriverDetail.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Check permissions
    if (req.user?.role !== 'admin' && driver.userId.toString() !== req.user?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    // Update fields
    if (licenseNumber && licenseNumber !== driver.licenseNumber) {
      // Check if new license number is unique
      const existingLicense = await DriverDetail.findOne({ 
        licenseNumber,
        _id: { $ne: req.params.id }
      });
      
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already in use'
        });
      }
      driver.licenseNumber = licenseNumber;
    }
    
    if (address) {
      driver.address = {
        street: address.street || driver.address.street,
        city: address.city || driver.address.city,
        state: address.state || driver.address.state,
        zipCode: address.zipCode || driver.address.zipCode,
        country: address.country || driver.address.country
      };
    }
    
    // Only admins can update status
    if (status && req.user?.role === 'admin') {
      driver.status = status;
    }
    
    await driver.save();
    
    // Populate and return
    const updatedDriver = await DriverDetail.findById(driver._id)
      .populate('userId', 'fullname email phone role isActive')
      .populate('vehicleId', 'make model year licensePlate color vehicleType status');
    
    res.json({
      success: true,
      message: 'Driver updated successfully',
      driver: updatedDriver
    });
    
  } catch (error) {
    console.error('Error updating driver:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error updating driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/drivers/:id/status - Update driver status (admin only)
router.patch('/admin/drivers/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    const driver = await DriverDetail.findById(req.params.id)
      .populate('userId', 'fullname email phone role isActive');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Update user status
    const isActive = status === 'active';
    const updatedUser = await User.findByIdAndUpdate(
      driver.userId._id,
      { isActive },
      { new: true }
    );
    
    // Refresh driver data
    const updatedDriver = await DriverDetail.findById(driver._id)
      .populate('userId', 'fullname email phone role isActive');
    
    res.json({
      success: true,
      message: `Driver status updated to ${status}`,
      driver: updatedDriver
    });
    
  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating driver status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/drivers/:id/verify - Verify driver (admin only)
router.patch('/admin/drivers/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const driver = await DriverDetail.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verifiedAt: new Date()
      },
      { new: true }
    ).populate('userId', 'fullname email phone role isActive');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Driver verified successfully',
      driver
    });
    
  } catch (error) {
    console.error('Error verifying driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/drivers/:id/assign-vehicle - Assign vehicle to driver (admin only)
router.post('/admin/drivers/:id/assign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required'
      });
    }
    
    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }
    
    // Check if vehicle is already assigned
    if (vehicle.status === 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is already assigned to another driver'
      });
    }
    
    // Check if driver exists
    const driver = await DriverDetail.findById(req.params.id);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }
    
    // Update vehicle status
    vehicle.status = 'assigned';
    await vehicle.save();
    
    // Assign vehicle to driver
    driver.vehicleId = vehicleId;
    await driver.save();
    
    // Populate and return
    const updatedDriver = await DriverDetail.findById(driver._id)
      .populate('userId', 'fullname email phone role isActive')
      .populate('vehicleId', 'make model year licensePlate color vehicleType status');
    
    res.json({
      success: true,
      message: 'Vehicle assigned to driver successfully',
      driver: updatedDriver
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

// GET /api/drivers/available - Get available drivers (without vehicles)
router.get('/admin/drivers/available/without-vehicles', auth, async (req, res) => {
  try {
    const drivers = await DriverDetail.find({
      vehicleId: { $eq: null },
      status: 'active'
    })
    .populate('userId', 'fullname email phone role isActive')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      drivers,
      count: drivers.length
    });
    
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/drivers/stats/summary - Get driver statistics
router.get('/admin/drivers/stats/summary', auth, isAdmin, async (req, res) => {
  try {
    const totalDrivers = await DriverDetail.countDocuments();
    const activeDrivers = await DriverDetail.countDocuments({ status: 'active' });
    const pendingDrivers = await DriverDetail.countDocuments({ status: 'pending' });
    const verifiedDrivers = await DriverDetail.countDocuments({ isVerified: true });
    const driversWithVehicles = await DriverDetail.countDocuments({ 
      vehicleId: { $ne: null } 
    });
    
    res.json({
      success: true,
      stats: {
        totalDrivers,
        activeDrivers,
        pendingDrivers,
        verifiedDrivers,
        driversWithVehicles
      }
    });
    
  } catch (error) {
    console.error('Error fetching driver stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching driver statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// DELETE /api/drivers/:id - Delete driver (admin only)
router.delete('/admin/drivers/:id', auth, isAdmin, async (req, res) => {
  try {
    // First check if this is a userId or driverDetailId
    const driverDetail = await DriverDetail.findOne({ userId: req.params.id });
    
    if (driverDetail) {
      // If driver details exist, delete them
      if (driverDetail.vehicleId) {
        await Vehicle.findByIdAndUpdate(driverDetail.vehicleId, { status: 'available' });
      }
      await DriverDetail.findByIdAndDelete(driverDetail._id);
    }
    
    // Always delete the user
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Driver deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;