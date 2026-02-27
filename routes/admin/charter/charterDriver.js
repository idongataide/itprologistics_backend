// routes/charterDriver.js

const express = require('express');
const router = express.Router();
const auth = require('../../../middleware/authMiddleware');
const CharterDriver = require('../../../models/charter/CharterDriver');
const User = require('../../../models/User');
const CharterVehicle = require('../../../models/charter/CharterVehicle');

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

// GET /api/admin/charter/drivers - Get all charter drivers
router.get('/drivers', auth, isAdmin, async (req, res) => {
  try {
    console.log('Fetching all charter drivers');
    
    // Get all users with charter-driver role
    const driverUsers = await User.find({ role: 'charter-driver' })
      .select('-password -__v')
      .sort({ createdAt: -1 });
    
    // Get charter driver details for these users
    const charterDrivers = await CharterDriver.find({})
      .populate('userId', 'fullname email phone role isActive createdAt')
      .populate('vehicleId');
    
    // Create a map for quick lookup
    const detailsMap = {};
    charterDrivers.forEach(driver => {
      if (driver.userId) {
        detailsMap[driver.userId._id.toString()] = driver;
      }
    });
    
    // Combine user info with charter driver details
    const drivers = driverUsers.map(user => {
      const charterDriver = detailsMap[user._id.toString()];
      
      return {
        _id: charterDriver?._id || null,
        userId: user._id,
        name: user.fullname,
        email: user.email,
        phone: user.phone,
        userStatus: user.isActive ? 'active' : 'inactive',
        role: user.role,
        createdAt: user.createdAt,
        // Charter driver details (if exists)
        driverId: charterDriver?._id,
        status: charterDriver?.status || 'pending',
        licenseNumber: charterDriver?.licenseNumber,
        address: charterDriver?.address,
        vehicle: charterDriver?.vehicleId,
        isVerified: charterDriver?.isVerified || false,
        verifiedAt: charterDriver?.verifiedAt,
        totalTrips: charterDriver?.totalTrips || 0,
        experience: charterDriver?.experience || 0,
        specialLicenses: charterDriver?.specialLicenses || [],
        languages: charterDriver?.languages || [],
        emergencyContact: charterDriver?.emergencyContact,
        hasDriverDetails: !!charterDriver
      };
    });
    
    console.log(`Found ${drivers.length} charter driver users`);
    
    // Get stats
    const totalDrivers = drivers.length;
    const activeDrivers = drivers.filter(d => d.status === 'active').length;
    const pendingDrivers = drivers.filter(d => d.status === 'pending').length;
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
    console.error('Error fetching charter drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/charter/drivers/:id - Get single charter driver by ID
router.get('/drivers/:id', auth, isAdmin, async (req, res) => {
  try {
    const driver = await CharterDriver.findById(req.params.id)
      .populate('userId', 'fullname email phone role isActive createdAt')
      .populate('vehicleId');
    
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    res.json({
      success: true,
      driver
    });
    
  } catch (error) {
    console.error('Error fetching charter driver:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/admin/charter/drivers/details - Create charter driver details for existing user
router.post('/drivers/details', auth, isAdmin, async (req, res) => {
  try {
    const { 
      userId, 
      licenseNumber, 
      address, 
      experience,
      specialLicenses,
      languages,
      emergencyContact 
    } = req.body;
    
    console.log('Creating charter driver details for user:', userId);
    
    // Validate required fields
    if (!userId || !licenseNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'User ID, license number, and address are required'
      });
    }
    
    // Check if user exists and has charter-driver role
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    if (user.role !== 'charter-driver') {
      return res.status(400).json({
        success: false,
        message: 'User must have charter-driver role'
      });
    }
    
    // Check if charter driver details already exist
    const existingDriver = await CharterDriver.findOne({ userId });
    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: 'Charter driver details already exist for this user'
      });
    }
    
    // Check if license number is unique
    const existingLicense = await CharterDriver.findOne({ licenseNumber });
    if (existingLicense) {
      return res.status(400).json({
        success: false,
        message: 'License number already in use'
      });
    }
    
    // Create charter driver details
    const charterDriver = new CharterDriver({
      userId,
      licenseNumber,
      address: {
        street: address.street || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || 'Nigeria'
      },
      experience: experience || 0,
      specialLicenses: specialLicenses || [],
      languages: languages || [],
      emergencyContact: emergencyContact || {},
      status: 'pending'
    });
    
    await charterDriver.save();
    
    // Populate and return
    const populatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('userId', 'fullname email phone role isActive');
    
    res.status(201).json({
      success: true,
      message: 'Charter driver details created successfully',
      driver: populatedDriver
    });
    
  } catch (error) {
    console.error('Error creating charter driver details:', error);
    
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
      message: 'Server error creating charter driver details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/admin/charter/drivers/:id - Update charter driver details
router.put('/drivers/:id', auth, isAdmin, async (req, res) => {
  try {
    const { 
      licenseNumber, 
      address, 
      status,
      experience,
      specialLicenses,
      languages,
      emergencyContact 
    } = req.body;
    
    // Find charter driver
    let charterDriver = await CharterDriver.findById(req.params.id);
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    // Update license number if provided and unique
    if (licenseNumber && licenseNumber !== charterDriver.licenseNumber) {
      const existingLicense = await CharterDriver.findOne({ 
        licenseNumber,
        _id: { $ne: req.params.id }
      });
      
      if (existingLicense) {
        return res.status(400).json({
          success: false,
          message: 'License number already in use'
        });
      }
      charterDriver.licenseNumber = licenseNumber;
    }
    
    // Update address if provided
    if (address) {
      charterDriver.address = {
        street: address.street || charterDriver.address.street,
        city: address.city || charterDriver.address.city,
        state: address.state || charterDriver.address.state,
        zipCode: address.zipCode || charterDriver.address.zipCode,
        country: address.country || charterDriver.address.country
      };
    }
    
    // Update other fields
    if (status) charterDriver.status = status;
    if (experience !== undefined) charterDriver.experience = experience;
    if (specialLicenses) charterDriver.specialLicenses = specialLicenses;
    if (languages) charterDriver.languages = languages;
    if (emergencyContact) charterDriver.emergencyContact = emergencyContact;
    
    await charterDriver.save();
    
    // Populate and return
    const updatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('userId', 'fullname email phone role isActive')
      .populate('vehicleId');
    
    res.json({
      success: true,
      message: 'Charter driver updated successfully',
      driver: updatedDriver
    });
    
  } catch (error) {
    console.error('Error updating charter driver:', error);
    
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
      message: 'Server error updating charter driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/admin/charter/drivers/:id/status - Update charter driver status
router.patch('/drivers/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status || !['active', 'inactive', 'pending', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }
    
    const charterDriver = await CharterDriver.findById(req.params.id)
      .populate('userId', 'fullname email phone role isActive');
    
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    // Update driver status
    charterDriver.status = status;
    await charterDriver.save();
    
    // Update user active status if needed
    if (status === 'active') {
      await User.findByIdAndUpdate(
        charterDriver.userId._id,
        { isActive: true }
      );
    } else if (status === 'inactive' || status === 'suspended') {
      await User.findByIdAndUpdate(
        charterDriver.userId._id,
        { isActive: false }
      );
    }
    
    // Refresh driver data
    const updatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('userId', 'fullname email phone role isActive');
    
    res.json({
      success: true,
      message: `Charter driver status updated to ${status}`,
      driver: updatedDriver
    });
    
  } catch (error) {
    console.error('Error updating charter driver status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating charter driver status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PATCH /api/admin/charter/drivers/:id/verify - Verify charter driver
router.patch('/drivers/:id/verify', auth, isAdmin, async (req, res) => {
  try {
    const { verificationNotes } = req.body;
    
    const charterDriver = await CharterDriver.findByIdAndUpdate(
      req.params.id,
      { 
        isVerified: true,
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || 'Verified by admin'
      },
      { new: true }
    ).populate('userId', 'fullname email phone role isActive');
    
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Charter driver verified successfully',
      driver: charterDriver
    });
    
  } catch (error) {
    console.error('Error verifying charter driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error verifying charter driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/admin/charter/drivers/:id/assign-vehicle - Assign vehicle to charter driver
router.post('/drivers/:id/assign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    const { vehicleId } = req.body;
    
    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle ID is required'
      });
    }
    
    // Check if vehicle exists
    const vehicle = await CharterVehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Charter vehicle not found'
      });
    }
    
    // Check if vehicle is already assigned
    if (vehicle.status === 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle is already assigned to another driver'
      });
    }
    
    // Check if charter driver exists
    const charterDriver = await CharterDriver.findById(req.params.id);
    if (!charterDriver) {
      return res.status(404).json({
        success: false,
        message: 'Charter driver not found'
      });
    }
    
    // Update vehicle status
    vehicle.status = 'assigned';
    vehicle.driverId = charterDriver._id;
    await vehicle.save();
    
    // Assign vehicle to driver
    charterDriver.vehicleId = vehicleId;
    await charterDriver.save();
    
    // Populate and return
    const updatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('userId', 'fullname email phone role isActive')
      .populate('vehicleId');
    
    res.json({
      success: true,
      message: 'Vehicle assigned to charter driver successfully',
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

// POST /api/admin/charter/drivers/:id/unassign-vehicle - Unassign vehicle from charter driver
router.post('/drivers/:id/unassign-vehicle', auth, isAdmin, async (req, res) => {
  try {
    // Find charter driver
    const charterDriver = await CharterDriver.findById(req.params.id);
    
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
    
    // Find vehicle and update status
    const vehicle = await CharterVehicle.findById(charterDriver.vehicleId);
    if (vehicle) {
      vehicle.status = 'available';
      vehicle.driverId = null;
      await vehicle.save();
    }
    
    // Remove vehicle from driver
    charterDriver.vehicleId = null;
    await charterDriver.save();
    
    // Return updated driver
    const updatedDriver = await CharterDriver.findById(charterDriver._id)
      .populate('userId', 'fullname email phone role isActive');
    
    res.json({
      success: true,
      message: 'Vehicle unassigned from charter driver successfully',
      driver: updatedDriver
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

// GET /api/admin/charter/drivers/available/without-vehicles - Get available charter drivers without vehicles
router.get('/admin/charter/drivers/available/without-vehicles', auth, isAdmin, async (req, res) => {
  try {
    const drivers = await CharterDriver.find({
      vehicleId: { $eq: null },
      status: 'active',
      isVerified: true
    })
    .populate('userId', 'fullname email phone role isActive')
    .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      drivers,
      count: drivers.length
    });
    
  } catch (error) {
    console.error('Error fetching available charter drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available charter drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/admin/charter/drivers/stats/summary - Get charter driver statistics
router.get('/admin/charter/drivers/stats/summary', auth, isAdmin, async (req, res) => {
  try {
    const totalDrivers = await CharterDriver.countDocuments();
    const activeDrivers = await CharterDriver.countDocuments({ status: 'active' });
    const pendingDrivers = await CharterDriver.countDocuments({ status: 'pending' });
    const verifiedDrivers = await CharterDriver.countDocuments({ isVerified: true });
    const driversWithVehicles = await CharterDriver.countDocuments({ 
      vehicleId: { $ne: null } 
    });
    
    // Get language distribution
    const languageStats = await CharterDriver.aggregate([
      { $unwind: '$languages' },
      { $group: { _id: '$languages', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalDrivers,
        activeDrivers,
        pendingDrivers,
        verifiedDrivers,
        driversWithVehicles,
        languageStats
      }
    });
    
  } catch (error) {
    console.error('Error fetching charter driver stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter driver statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/admin/charter/drivers/:id - Delete charter driver
router.delete('/admin/charter/drivers/:id', auth, isAdmin, async (req, res) => {
  try {
    // First check if this is a userId or charterDriverId
    const charterDriver = await CharterDriver.findOne({ userId: req.params.id });
    
    if (charterDriver) {
      // If charter driver has a vehicle, update its status
      if (charterDriver.vehicleId) {
        await CharterVehicle.findByIdAndUpdate(charterDriver.vehicleId, { 
          status: 'available',
          driverId: null 
        });
      }
      await CharterDriver.findByIdAndDelete(charterDriver._id);
    } else {
      // Try finding by _id
      const driverById = await CharterDriver.findById(req.params.id);
      if (driverById) {
        if (driverById.vehicleId) {
          await CharterVehicle.findByIdAndUpdate(driverById.vehicleId, { 
            status: 'available',
            driverId: null 
          });
        }
        await CharterDriver.findByIdAndDelete(req.params.id);
      }
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
      message: 'Charter driver deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting charter driver:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting charter driver',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;