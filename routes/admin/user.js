const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const User = require('../../models/User');

// Get all users (Admin only)
router.get('/admin/users', auth, async (req, res) => {
  console.log('Getting all users');
  try {
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User not found'
      });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    let query = {};
    if (req.query.roles) {
      const rolesArray = req.query.roles.split(',');
      query = { role: { $in: rolesArray } };
    }

    // Get all users excluding passwords
    const users = await User.find(query, '-password -__v')
      .sort({ createdAt: -1 })
      .lean();

    // Format the response
    const formattedUsers = users.map(user => ({
      id: user._id,
      name: user.fullname,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.isActive ? 'active' : 'inactive',
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
      isEmailVerified: user.isEmailVerified || false,
      isPhoneVerified: user.isPhoneVerified || false,
      profileImage: user.profileImage || null
    }));

    res.json({
      success: true,
      users: formattedUsers,
      count: users.length
    });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error fetching users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get single user by ID (Admin only)
router.get('/admin/users/:id', auth, async (req, res) => {
  try {
    // Check if requesting user exists and is admin
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User not found'
      });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    const user = await User.findById(req.params.id, '-password -__v');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.isActive ? 'active' : 'inactive',
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
        isEmailVerified: user.isEmailVerified || false,
        isPhoneVerified: user.isPhoneVerified || false,
        profileImage: user.profileImage || null
      }
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Update user (Admin only)
router.put('/admin/users/:id', auth, async (req, res) => {
  try {
    // Check if requesting user exists and is admin
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User not found'
      });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    const { name, email, phone, role, status } = req.body;
    
    // Find the user to update
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
      user.email = email;
    }

    // Check if phone is being changed and if it already exists
    if (phone && phone !== user.phone) {
      const existingUser = await User.findOne({ phone });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
      user.phone = phone;
    }

    // Update other fields
    if (name) user.fullname = name;
    if (role) user.role = role;
    if (status !== undefined) user.isActive = status === 'active';

    // Save updated user
    await user.save();

    // Return updated user (excluding password)
    const updatedUser = await User.findById(user._id, '-password -__v');

    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.fullname,
        email: updatedUser.email,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.isActive ? 'active' : 'inactive',
        createdAt: updatedUser.createdAt ? new Date(updatedUser.createdAt).toISOString().split('T')[0] : 'N/A',
        isEmailVerified: updatedUser.isEmailVerified || false,
        isPhoneVerified: updatedUser.isPhoneVerified || false,
        profileImage: updatedUser.profileImage || null
      }
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Delete user (Admin only)
router.delete('/admin/users/:id', auth, async (req, res) => {
  try {
    // Check if requesting user exists and is admin
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User not found'
      });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Update user status (Admin only)
router.patch('/admin/users/:id/status', auth, async (req, res) => {
  try {
    // Check if requesting user exists and is admin
    const requestingUser = await User.findById(req.user.id);
    if (!requestingUser) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed: User not found'
      });
    }

    if (requestingUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Admin only'
      });
    }

    const { status } = req.body;
    
    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update status
    user.isActive = status === 'active';
    await user.save();

    res.json({
      success: true,
      message: `User ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        status: user.isActive ? 'active' : 'inactive'
      }
    });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating user status',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;