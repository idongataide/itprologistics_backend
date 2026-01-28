// routes/admin/rides.js
const express = require('express');
const router = express.Router();
const Ride = require('../../models/Ride');
const User = require('../../models/User');
const DriverDetail = require('../../models/AdminDriver');
const Vehicle = require('../../models/Vehicle');
const auth = require('../../middleware/authMiddleware');

// Admin middleware to verify admin role
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

// @route   GET /api/admin/rides
// @desc    Get all rides (admin view)
// @access  Private (Admin only)
router.get('/admin/rides', auth, isAdmin, async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate('userId', 'fullname phone email')
      .sort({ createdAt: -1 });

    // Handle both DriverDetail IDs and User IDs stored in driverId
    const enrichedRides = await Promise.all(rides.map(async (ride) => {
      let driverInfo = null;
      
      if (ride.driverId) {
        // Try to find as DriverDetail first
        let driverDetail = await DriverDetail.findById(ride.driverId)
          .populate('userId', 'fullname phone email');
        
        // If not found, assume it's a User ID and find the associated DriverDetail
        if (!driverDetail) {
          driverDetail = await DriverDetail.findOne({ userId: ride.driverId })
            .populate('userId', 'fullname phone email');
        }
        
        driverInfo = driverDetail;
      }
      
      return {
        ...ride.toObject(),
        driverDetail: driverInfo
      };
    }));

      
      // Format rides for response
      const formattedRides = enrichedRides.map(ride => ({
          _id: ride._id,
          userId: ride.userId || null,
          userName: ride.userId?.fullname || 'N/A',
          phoneNumber: ride.userId?.phone || 'N/A',
          driverId: ride.driverDetail?._id || null,
          driverName: ride.driverDetail?.userId?.fullname || 'Unassigned',
          pickupLocation: ride.pickupLocation,
          destination: ride.destination,
          status: ride.status,
          rideType: ride.rideType,
          totalFare: ride.totalFare,
          distance: ride.distance,
          estimatedDuration: ride.estimatedDuration,
          createdAt: ride.createdAt,
          updatedAt: ride.updatedAt
        }));

    res.json({
      success: true,
      message: 'Rides fetched successfully',
      rides: formattedRides
    });
  } catch (error) {
    console.error('Error fetching all rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/rides/:rideId/assign
// @desc    Assign a driver to a ride
// @access  Private (Admin only)
router.put('/admin/rides/:rideId/assign', auth, isAdmin, async (req, res) => {
    
  try {
    const { rideId } = req.params;
    const { driverId } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required'
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }


    // Check if ride is in pending state
    if (ride.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Ride must be in pending state to assign driver'
      });
    }

    // Check if driver exists - find DriverDetail first
    let driverDetail = await DriverDetail.findById(driverId);
    let driverDetailId = driverId;
    
    // If not found as DriverDetail, try to find by User ID
    if (!driverDetail) {
      driverDetail = await DriverDetail.findOne({ userId: driverId });
      if (!driverDetail) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }
      driverDetailId = driverDetail._id;
    }
    
    // Verify the associated user is a driver
    const driver = await User.findById(driverDetail.userId);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        success: false,
        message: 'Driver not found or invalid'
      });
    }

    // Update ride with driver and status
    ride.driverId = driverDetailId;
    ride.status = 'awaiting_driver_confirmation';
    ride.acceptedAt = new Date();
    await ride.save();

    // Fetch the updated ride with populated data
    const updatedRide = await Ride.findById(rideId);
    
    let driverDetailPopulated = null;
    if (updatedRide.driverId) {
      driverDetailPopulated = await DriverDetail.findById(updatedRide.driverId)
        .populate('userId', 'fullname phone');
      
      if (!driverDetailPopulated) {
        driverDetailPopulated = await DriverDetail.findOne({ userId: updatedRide.driverId })
          .populate('userId', 'fullname phone');
      }
    }
    
    const userInfo = await User.findById(updatedRide.userId);

    res.json({
      success: true,
      message: 'Driver assigned successfully',
      ride: {
        _id: updatedRide._id,
        userId: updatedRide.userId?._id || userInfo?._id,
        userName: userInfo?.fullname || 'N/A',
        phoneNumber: userInfo?.phone || 'N/A',
        driverId: driverDetailPopulated?._id,
        driverName: driverDetailPopulated?.userId?.fullname || 'Unassigned',
        pickupLocation: updatedRide.pickupLocation,
        destination: updatedRide.destination,
        status: updatedRide.status,
        rideType: updatedRide.rideType,
        totalFare: updatedRide.totalFare,
        distance: updatedRide.distance,
        estimatedDuration: updatedRide.estimatedDuration,
        createdAt: updatedRide.createdAt,
        updatedAt: updatedRide.updatedAt
      }
    });
  } catch (error) {
    console.error('Error assigning driver:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/rides/:rideId/complete
// @desc    Complete a ride
// @access  Private (Admin only)
router.put('/admin/rides/:rideId/complete', auth, isAdmin, async (req, res) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Check if ride is in a valid state to complete
    if (!['accepted', 'in_progress', 'arrived'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Ride cannot be completed from ${ride.status} status`
      });
    }

    // Update ride status
    ride.status = 'completed';
    ride.completedAt = new Date();
    await ride.save();

    await ride.populate('driverId', 'fullname');
    await ride.populate('userId', 'fullname phone');

    res.json({
      success: true,
      message: 'Ride completed successfully',
      ride: {
        _id: ride._id,
        status: ride.status,
        completedAt: ride.completedAt
      }
    });
  } catch (error) {
    console.error('Error completing ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete ride',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/rides/:rideId/decline
// @desc    Decline/Cancel a ride
// @access  Private (Admin only)
router.put('/admin/rides/:rideId/decline', auth, isAdmin, async (req, res) => {
  try {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Check if ride can be cancelled
    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({
        success: false,
        message: `Ride cannot be cancelled from ${ride.status} status`
      });
    }

    // Update ride status
    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    await ride.save();

    res.json({
      success: true,
      message: 'Ride declined successfully',
      ride: {
        _id: ride._id,
        status: ride.status,
        cancelledAt: ride.cancelledAt
      }
    });
  } catch (error) {
    console.error('Error declining ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline ride',
      error: error.message
    });
  }
});

// @route   GET /api/admin/drivers/available/:rideId
// @desc    Get all available drivers with matching vehicle type for the ride
// @access  Private (Admin only)
router.get('/admin/drivers/available/:rideId', auth, isAdmin, async (req, res) => {
  try {
    const { rideId } = req.params;

    // Get the ride to check the ride type
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    const requestedRideType = ride.rideType; // e.g., 'car', 'motorcycle', 'bicycle'

    // Get all active drivers with a vehicle assigned and matching vehicle type
    const drivers = await DriverDetail.find({ 
      vehicleId: { $exists: true, $ne: null } // Must have a vehicle assigned
    })
      .populate({
        path: 'userId',
        match: { isActive: true }, // Only active drivers
        select: 'fullname phoneNumber email isActive'
      })
      .populate({
        path: 'vehicleId',
        match: { vehicleType: requestedRideType }, // Vehicle type must match ride type
        select: 'make model licensePlate color vehicleType'
      })
      .sort({ createdAt: 1 });

    // Filter out drivers whose vehicle doesn't match or user is not active (populate sets to null if no match)
    const filteredDrivers = drivers.filter(driver => driver.vehicleId !== null && driver.userId !== null);

    res.json({
      success: true,
      message: 'Available drivers fetched successfully',
      drivers: filteredDrivers.map(driver => ({
        _id: driver._id,
        name: driver.userId?.fullname,
        phone: driver.userId?.phoneNumber,
        email: driver.userId?.email,
        status: 'active',
        rating: driver.driverRating || 0,
        totalTrips: driver.totalTrips || 0,
        vehicle: driver.vehicleId ? {
          make: driver.vehicleId.make,
          model: driver.vehicleId.model,
          licensePlate: driver.vehicleId.licensePlate,
          color: driver.vehicleId.color,
          vehicleType: driver.vehicleId.vehicleType
        } : null
      }))
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
});

// @route   PATCH /api/admin/rides/:rideId/status
// @desc    Update ride status
// @access  Private (Admin only)
router.patch('/admin/rides/:rideId/status', auth, isAdmin, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Valid status transitions
    const validStatuses = ['pending', 'searching', 'awaiting_driver_confirmation', 'accepted', 'picked_up', 'in_progress', 'completed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Update status with appropriate timestamps
    ride.status = status;

    if (status === 'picked_up') {
      ride.pickedUpAt = new Date();
    } else if (status === 'in_progress') {
      ride.startedAt = new Date();
    } else if (status === 'completed') {
      ride.completedAt = new Date();
      ride.paymentStatus = 'pending';
    }

    await ride.save();

    // Populate the updated ride for response
    let driverInfo = null;
    if (ride.driverId) {
      driverInfo = await DriverDetail.findById(ride.driverId)
        .populate('userId', 'fullname phone');
      
      if (!driverInfo) {
        driverInfo = await DriverDetail.findOne({ userId: ride.driverId })
          .populate('userId', 'fullname phone');
      }
    }

    const userInfo = await User.findById(ride.userId);

    res.json({
      success: true,
      message: `Ride status updated to ${status}`,
      ride: {
        _id: ride._id,
        userId: ride.userId,
        userName: userInfo?.fullname || 'N/A',
        phoneNumber: userInfo?.phone || 'N/A',
        driverId: driverInfo?._id,
        driverName: driverInfo?.userId?.fullname || 'Unassigned',
        pickupLocation: ride.pickupLocation,
        destination: ride.destination,
        status: ride.status,
        rideType: ride.rideType,
        totalFare: ride.totalFare,
        distance: ride.distance,
        estimatedDuration: ride.estimatedDuration,
        createdAt: ride.createdAt,
        updatedAt: ride.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating ride status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ride status',
      error: error.message
    });
  }
});

// @route   GET /api/admin/drivers
// @desc    Get all drivers (for assignment)
// @access  Private (Admin only)
router.get('/admin/drivers', auth, isAdmin, async (req, res) => {
  try {
    // Get all drivers currently on active rides
    const driversOnRide = await Ride.find({
      status: { $in: ['accepted', 'in_progress', 'arrived'] }
    }).select('driverId');

    const driversOnRideIds = driversOnRide.map(ride => ride.driverId?.toString()).filter(Boolean);

    // Get all drivers
    const drivers = await User.find({ role: 'driver' })
      .select('fullName phoneNumber email rating totalTrips')
      .sort({ fullName: 1 });

    res.json({
      success: true,
      message: 'Drivers fetched successfully',
      drivers: drivers.map(driver => ({
        _id: driver._id,
        name: driver.fullName,
        phone: driver.phoneNumber,
        email: driver.email,
        status: driversOnRideIds.includes(driver._id.toString()) ? 'on_ride' : 'active',
        rating: driver.rating,
        totalTrips: driver.totalTrips || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers',
      error: error.message
    });
  }
});

module.exports = router;
