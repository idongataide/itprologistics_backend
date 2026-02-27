// routes/admin/charter/charterOrder.js

const express = require('express');
const router = express.Router();
const CharterOrder = require('../../../models/charter/CharterOrder');
const User = require('../../../models/User');
const CharterDriver = require('../../../models/charter/CharterDriver');
const CharterVehicle = require('../../../models/charter/CharterVehicle');
const auth = require('../../../middleware/authMiddleware');

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

// @route   GET /api/admin/charter/orders
// @desc    Get all charter orders
// @access  Admin
router.get('/orders', auth, isAdmin, async (req, res) => {
  try {
    const orders = await CharterOrder.find({})
      .populate('userId', 'fullname email phone')
      .populate('driverId', 'licenseNumber experience languages')
      .populate('vehicleId', 'make model licensePlate capacity vehicleType')
      .populate('vehicleNeeded', 'make model year licensePlate color vehicleType capacity thumbnail features fuelType status')
      .sort({ createdAt: -1 });

    // Enhance orders with user details
    const enhancedOrders = await Promise.all(orders.map(async (order) => {
      const orderObj = order.toObject();
      
      // Get user details
      if (order.userId) {
        orderObj.user = {
          _id: order.userId._id,
          name: order.userId.fullname,
          email: order.userId.email,
          phone: order.userId.phone
        };
      }

      // Get driver details if assigned
      if (order.driverId) {
        const driverUser = await User.findById(order.driverId.userId).select('fullname phone');
        orderObj.driver = {
          _id: order.driverId._id,
          name: driverUser?.fullname || 'Unknown',
          phone: driverUser?.phone || 'N/A',
          experience: order.driverId.experience,
          languages: order.driverId.languages
        };
      }

      // Get vehicle details if assigned
      if (order.vehicleId) {
        orderObj.vehicle = {
          _id: order.vehicleId._id,
          make: order.vehicleId.make,
          model: order.vehicleId.model,
          licensePlate: order.vehicleId.licensePlate,
          capacity: order.vehicleId.capacity,
          vehicleType: order.vehicleId.vehicleType
        };
      }

      delete orderObj.userId;
      delete orderObj.driverId;
      delete orderObj.vehicleId;
      
      return orderObj;
    }));

    res.json({
      success: true,
      orders: enhancedOrders,
      count: enhancedOrders.length
    });
  } catch (error) {
    console.error('Error fetching charter orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/orders/:id
// @desc    Get single charter order by ID
// @access  Admin
router.get('/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const order = await CharterOrder.findById(req.params.id)
      .populate('userId', 'fullname email phone')
      .populate('driverId')
      .populate('vehicleId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter order not found'
      });
    }

    const orderObj = order.toObject();
    
    // Format user
    if (order.userId) {
      orderObj.user = {
        _id: order.userId._id,
        name: order.userId.fullname,
        email: order.userId.email,
        phone: order.userId.phone
      };
    }

    // Format driver if exists
    if (order.driverId) {
      const driverUser = await User.findById(order.driverId.userId).select('fullname phone');
      orderObj.driver = {
        _id: order.driverId._id,
        name: driverUser?.fullname || 'Unknown',
        phone: driverUser?.phone || 'N/A',
        licenseNumber: order.driverId.licenseNumber,
        experience: order.driverId.experience,
        languages: order.driverId.languages
      };
    }

    // Format vehicle if exists
    if (order.vehicleId) {
      orderObj.vehicle = {
        _id: order.vehicleId._id,
        make: order.vehicleId.make,
        model: order.vehicleId.model,
        licensePlate: order.vehicleId.licensePlate,
        capacity: order.vehicleId.capacity,
        vehicleType: order.vehicleId.vehicleType,
        color: order.vehicleId.color
      };
    }

    delete orderObj.userId;
    delete orderObj.driverId;
    delete orderObj.vehicleId;

    res.json({
      success: true,
      order: orderObj
    });
  } catch (error) {
    console.error('Error fetching charter order:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Charter order not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PATCH /api/admin/charter/orders/:id/status
// @desc    Update charter order status
// @access  Admin
router.patch('/orders/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const order = await CharterOrder.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter order not found'
      });
    }

    // Update status and corresponding timestamp
    order.status = status;
    
    switch (status) {
      case 'accepted':
        order.acceptedAt = new Date();
        break;
      case 'in_progress':
        order.startedAt = new Date();
        break;
      case 'completed':
        order.completedAt = new Date();
        break;
      case 'cancelled':
        order.cancelledAt = new Date();
        break;
    }

    await order.save();

    res.json({
      success: true,
      message: `Order status updated to ${status}`,
      order
    });
  } catch (error) {
    console.error('Error updating charter order status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating charter order status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   DELETE /api/admin/charter/orders/:id
// @desc    Delete charter order
// @access  Admin
router.delete('/orders/:id', auth, isAdmin, async (req, res) => {
  try {
    const order = await CharterOrder.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Charter order not found'
      });
    }

    await order.deleteOne();

    res.json({
      success: true,
      message: 'Charter order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting charter order:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting charter order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/orders/status/:status
// @desc    Get charter orders by status
// @access  Admin
router.get('/orders/status/:status', auth, isAdmin, async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const orders = await CharterOrder.find({ status })
      .populate('userId', 'fullname email phone')
      .sort({ createdAt: -1 });

    const enhancedOrders = orders.map(order => {
      const orderObj = order.toObject();
      if (order.userId) {
        orderObj.user = {
          _id: order.userId._id,
          name: order.userId.fullname,
          email: order.userId.email,
          phone: order.userId.phone
        };
      }
      delete orderObj.userId;
      return orderObj;
    });

    res.json({
      success: true,
      orders: enhancedOrders,
      count: enhancedOrders.length
    });
  } catch (error) {
    console.error('Error fetching charter orders by status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter orders by status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/orders/date-range
// @desc    Get charter orders by date range
// @access  Admin
router.get('/orders/date-range', auth, isAdmin, async (req, res) => {
  try {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const orders = await CharterOrder.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    })
      .populate('userId', 'fullname email phone')
      .sort({ createdAt: -1 });

    const enhancedOrders = orders.map(order => {
      const orderObj = order.toObject();
      if (order.userId) {
        orderObj.user = {
          _id: order.userId._id,
          name: order.userId.fullname,
          email: order.userId.email,
          phone: order.userId.phone
        };
      }
      delete orderObj.userId;
      return orderObj;
    });

    res.json({
      success: true,
      orders: enhancedOrders,
      count: enhancedOrders.length
    });
  } catch (error) {
    console.error('Error fetching charter orders by date range:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter orders by date range',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/admin/charter/orders/stats/summary
// @desc    Get charter order statistics
// @access  Admin
router.get('/orders/stats/summary', auth, isAdmin, async (req, res) => {
  try {
    const total = await CharterOrder.countDocuments();
    const pending = await CharterOrder.countDocuments({ status: 'pending' });
    const accepted = await CharterOrder.countDocuments({ status: 'accepted' });
    const inProgress = await CharterOrder.countDocuments({ status: 'in_progress' });
    const completed = await CharterOrder.countDocuments({ status: 'completed' });
    const cancelled = await CharterOrder.countDocuments({ status: 'cancelled' });

    // Get vehicle type distribution
    const vehicleTypeDistribution = await CharterOrder.aggregate([
      { $group: { _id: '$vehicleNeeded', count: { $sum: 1 } } }
    ]);

    // Get monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrends = await CharterOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        total,
        pending,
        accepted,
        inProgress,
        completed,
        cancelled,
        byVehicleType: vehicleTypeDistribution,
        monthlyTrends
      }
    });
  } catch (error) {
    console.error('Error fetching charter order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching charter order statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;