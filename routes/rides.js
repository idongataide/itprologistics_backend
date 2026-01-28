// routes/rides.js
const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const DriverDetail = require('../models/AdminDriver');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const auth = require('../middleware/authMiddleware');

// Pricing configuration in Naira (₦)
const PRICING_CONFIG = {
  bicycle: {
    baseFare: 200,
    perKm: 50,
    perMinute: 10,
    serviceFeePercent: 5
  },
  motorcycle: {
    baseFare: 300,
    perKm: 100,
    perMinute: 15,
    serviceFeePercent: 8
  },
  car: {
    baseFare: 500,
    perKm: 150,
    perMinute: 20,
    serviceFeePercent: 10
  }
};

// Helper function to calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// @route   POST /api/rides/estimate
// @desc    Get ride estimate
// @access  Private
router.post('/estimate', auth, async (req, res) => {
  try {
    const { pickupLat, pickupLng, destLat, destLng, rideType } = req.body;

    if (!pickupLat || !pickupLng || !destLat || !destLng || !rideType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field'
      });
    }

    // Calculate distance
    const distance = calculateDistance(pickupLat, pickupLng, destLat, destLng);
    
    // Calculate estimated duration
    const estimatedDuration = Math.round((distance / 30) * 60);
    const minDuration = Math.max(5, estimatedDuration - 5);
    const maxDuration = estimatedDuration + 5;

    // Get pricing config
    const config = PRICING_CONFIG[rideType];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride type'
      });
    }

    // Calculate fare in Naira
    const baseFare = config.baseFare;
    const distanceFare = Math.round(distance * config.perKm);
    const timeFare = Math.round(estimatedDuration * config.perMinute);
    
    const subtotal = baseFare + distanceFare + timeFare;
    const serviceFee = Math.round(subtotal * (config.serviceFeePercent / 100));
    const totalFare = Math.round(subtotal + serviceFee);

    res.json({
      success: true,
      estimate: {
        distance: parseFloat(distance.toFixed(2)),
        duration: estimatedDuration,
        minDuration,
        maxDuration,
        baseFare,
        distanceFare,
        timeFare,
        serviceFee,
        totalFare,
        currency: 'NGN',
        rideType,
        perKmRate: config.perKm,
        baseRate: config.baseFare
      }
    });

  } catch (error) {
    console.error('Error calculating estimate:', error);
    res.status(500).json({
      success: false,
      message: 'Server error calculating estimate'
    });
  }
});

router.post('/order', auth, async (req, res) => {
  try {
    const {
      pickupLocation,
      pickupLat,
      pickupLng,
      destination,
      destLat,
      destLng,
      rideType,
      instructions,
      paymentMethod,
      phoneNumber,
      distance,
      estimatedDuration,
      baseFare,
      distanceFare,
      totalFare
    } = req.body;

    console.log(req,'llll')

    // Validate required fields
    if (!pickupLocation || !pickupLat || !pickupLng || 
        !destination || !destLat || !destLng || 
        !rideType || !paymentMethod || !phoneNumber ||
        !distance || !estimatedDuration || !totalFare) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate ride type
    if (!PRICING_CONFIG[rideType]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ride type'
      });
    }

    // Create new ride with all the calculated values
    const ride = new Ride({
      userId: req.user.id,
      status: 'pending', // Stay as pending - admin will assign driver
      pickupLocation: {
        address: pickupLocation,
        coordinates: {
          lat: pickupLat,
          lng: pickupLng
        }
      },
      destination: {
        address: destination,
        coordinates: {
          lat: destLat,
          lng: destLng
        }
      },
      rideType,
      distance: parseFloat(distance),
      estimatedDuration: parseInt(estimatedDuration),
      baseFare: baseFare || PRICING_CONFIG[rideType].baseFare,
      distanceFare: distanceFare || 0,
      totalFare: parseFloat(totalFare),
      paymentMethod,
      paymentStatus: 'pending',
      instructions: instructions || '',
      phoneNumber
    });

    await ride.save();

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully. Waiting for admin to assign a driver.',
      ride
    });

  } catch (error) {
    console.error('Error creating ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating ride'
    });
  }
});

// @route   GET /api/rides/my-rides
// @desc    Get user's rides (as rider)
// @access  Private
router.get('/my-rides', auth, async (req, res) => {
  try {
    const rides = await Ride.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('driverId')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'name phone'
        }
      });

    res.json({
      success: true,
      rides
    });
  } catch (error) {
    console.error('Error fetching rides:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching rides'
    });
  }
});

// @route   GET /api/rides/driver/my-rides
// @desc    Get driver's assigned rides
// @access  Private
router.get('/driver/my-rides', auth, async (req, res) => {
  try {
    // First, find the DriverDetail record using the user ID
    const driverDetail = await DriverDetail.findOne({ userId: req.user.id });

    if (!driverDetail) {
      return res.status(404).json({
        success: false,
        message: 'Driver profile not found'
      });
    }

    // Now find rides using the DriverDetail's ID
    const rides = await Ride.find({ driverId: driverDetail._id })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullname phone')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'fullname phone'
        }
      });

    res.json({
      success: true,
      rides
    });
  } catch (error) {
    console.error('Error fetching driver rides:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching driver rides'
    });
  }
});

// @route   GET /api/rides/active
// @desc    Get user's active ride
// @access  Private
router.get('/active', auth, async (req, res) => {
  try {
    const ride = await Ride.findOne({
      userId: req.user.id,
      status: { $in: ['pending', 'searching', 'accepted', 'arrived', 'in_progress'] }
    })
    .populate('driverId')
    .populate({
      path: 'driverId',
      populate: [
        {
          path: 'userId',
          select: 'name phone'
        },
        {
          path: 'vehicleId',
          select: 'make model licensePlate color vehicleType'
        }
      ]
    });

    res.json({
      success: true,
      ride: ride || null
    });
  } catch (error) {
    console.error('Error fetching active ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching active ride'
    });
  }
});

// @route   POST /api/rides/:id/cancel
// @desc    Cancel a ride
// @access  Private
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

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
        message: `Ride is already ${ride.status}`
      });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    await ride.save();

    res.json({
      success: true,
      message: 'Ride cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling ride'
    });
  }
});

// @route   GET /api/rides/:id/available-drivers
// @desc    Get available drivers for a ride
// @access  Private
router.get('/:id/available-drivers', auth, async (req, res) => {
  try {
    const ride = await Ride.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'searching'
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not searching for drivers'
      });
    }

    let availableDrivers = [];
    const { rideType, pickupLocation } = ride;

    // Find drivers based on ride type
    if (rideType === 'bicycle') {
      availableDrivers = await DriverDetail.find({
        vehicleId: { $exists: false },
        status: 'active',
        isVerified: true
      })
      .populate('userId', 'name phone rating')
      .limit(10);
    } else {
      // For motorcycle and car
      const vehicleType = rideType === 'motorcycle' ? 'motorcycle' : { $in: ['sedan', 'suv', 'van'] };

      availableDrivers = await DriverDetail.find({
        status: 'active',
        isVerified: true,
        vehicleId: { $exists: true }
      })
      .populate('userId', 'name phone rating')
      .populate('vehicleId')
      .then(drivers => drivers.filter(driver =>
        driver.vehicleId &&
        (rideType === 'motorcycle' ?
          driver.vehicleId.vehicleType === 'motorcycle' :
          ['sedan', 'suv', 'van'].includes(driver.vehicleId.vehicleType)
        )
      ))
      .limit(10);
    }

    res.json({
      success: true,
      availableDrivers,
      count: availableDrivers.length
    });
  } catch (error) {
    console.error('Error fetching available drivers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching available drivers'
    });
  }
});

// @route   POST /api/rides/:id/accept
// @desc    Driver accepts a ride
// @access  Private
router.post('/:id/accept', auth, async (req, res) => {
  try {
    // Find the driver detail using the user ID
    const driverDetail = await DriverDetail.findOne({ userId: req.user.id });

    if (!driverDetail) {
      return res.status(404).json({
        success: false,
        message: 'Driver profile not found'
      });
    }

    const ride = await Ride.findOne({
      _id: req.params.id,
      driverId: driverDetail._id,
      status: 'awaiting_driver_confirmation'
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not available for acceptance'
      });
    }

    ride.status = 'accepted';
    ride.acceptedAt = new Date();
    await ride.save();

    res.json({
      success: true,
      message: 'Ride accepted successfully',
      ride
    });
  } catch (error) {
    console.error('Error accepting ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error accepting ride'
    });
  }
});

// @route   POST /api/rides/:id/decline
// @desc    Driver declines a ride
// @access  Private
router.post('/:id/decline', auth, async (req, res) => {
  try {
    // Find the driver detail using the user ID
    const driverDetail = await DriverDetail.findOne({ userId: req.user.id });

    if (!driverDetail) {
      return res.status(404).json({
        success: false,
        message: 'Driver profile not found'
      });
    }

    const ride = await Ride.findOne({
      _id: req.params.id,
      driverId: driverDetail._id,
      status: 'awaiting_driver_confirmation'
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not available for decline'
      });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    await ride.save();

    res.json({
      success: true,
      message: 'Ride declined successfully',
      ride
    });
  } catch (error) {
    console.error('Error declining ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error declining ride'
    });
  }
});

// @route   PATCH /api/rides/:id/status
// @desc    Update ride status
// @access  Private
router.patch('/:id/status', auth, async (req, res) => {
  try {
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
    const ride = await Ride.findById(req.params.id)
      .populate('driverId')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'name phone'
        }
      });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found'
      });
    }

    // Check authorization - user must be either the rider or the driver
    const driverDetail = await DriverDetail.findOne({ userId: req.user.id });
    const isRider = ride.userId.toString() === req.user.id;
    const isDriver = driverDetail && ride.driverId && ride.driverId._id.toString() === driverDetail._id.toString();

    if (!isRider && !isDriver) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this ride'
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
      ride.paymentStatus = 'pending'; // Mark payment as pending after completion
    }

    await ride.save();

    // Populate the updated ride for response
    const updatedRide = await Ride.findById(req.params.id)
      .populate('driverId')
      .populate({
        path: 'driverId',
        populate: {
          path: 'userId',
          select: 'name phone'
        }
      });

    res.json({
      success: true,
      message: `Ride status updated to ${status}`,
      ride: updatedRide
    });
  } catch (error) {
    console.error('Error updating ride status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating ride status'
    });
  }
});

// @route   POST /api/rides/:id/rate
// @desc    Rate a completed ride
// @access  Private
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const ride = await Ride.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'completed'
    });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Completed ride not found'
      });
    }

    if (ride.riderRating) {
      return res.status(400).json({
        success: false,
        message: 'Ride already rated'
      });
    }

    ride.riderRating = rating;
    if (feedback) {
      ride.feedback = { ...ride.feedback, rider: feedback };
    }
    
    await ride.save();

    // Update driver's average rating
    if (ride.driverId) {
      const driverRides = await Ride.find({
        driverId: ride.driverId,
        riderRating: { $exists: true }
      });
      
      const averageRating = driverRides.reduce((sum, r) => sum + r.riderRating, 0) / driverRides.length;
      
      await DriverDetail.findByIdAndUpdate(ride.driverId, {
        driverRating: parseFloat(averageRating.toFixed(1))
      });
    }

    res.json({
      success: true,
      message: 'Ride rated successfully'
    });
  } catch (error) {
    console.error('Error rating ride:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rating ride'
    });
  }
});

module.exports = router;