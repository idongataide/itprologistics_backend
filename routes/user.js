const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Get current user's profile
router.get('/user/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Split fullname for first/last name
    const [firstName, ...lastArr] = user.fullname.split(' ');
    const lastName = lastArr.join(' ');
    
    res.json({
      success: true,
      data: {
        _id: user._id,
        firstName: firstName || '',
        lastName: lastName || '',
        email: user.email,
        phoneNumber: user.phone,
        gender: user.gender || '',
        isVerified: user.isVerified || false,
        role: user.role || 'user',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching profile' });
  }
});

// Update current user's profile
router.put('/user/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const { firstName, lastName, phoneNumber, gender } = req.body;
    
    // Update fullname if first or last name provided
    if (firstName || lastName) {
      const currentNameParts = user.fullname.split(' ');
      const updatedFirstName = firstName || currentNameParts[0];
      const updatedLastName = lastName || currentNameParts.slice(1).join(' ');
      user.fullname = [updatedFirstName, updatedLastName].filter(Boolean).join(' ');
    }
    
    if (phoneNumber) user.phone = phoneNumber;
    if (gender) user.gender = gender;
    
    await user.save();
    
    // Split the updated fullname for response
    const [updatedFirstName, ...updatedLastNameArr] = user.fullname.split(' ');
    const updatedLastName = updatedLastNameArr.join(' ');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: user._id,
        firstName: updatedFirstName,
        lastName: updatedLastName,
        email: user.email,
        phoneNumber: user.phone,
        gender: user.gender || '',
        isVerified: user.isVerified || false,
        role: user.role || 'user',
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

router.put('/user/change-password', auth, async (req, res) => {
  try {
    console.log('Change password request body:', req.body);
    const { old_password, new_password } = req.body;
    
    // Validate input
    if (!old_password || !new_password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both old and new password are required' 
      });
    }
    
    // Validate new password length - FIXED: 6 characters per your check
    if (new_password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 6 characters' // Changed to 6
      });
    }
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Check old password
    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    
    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(new_password, user.password);
    if (isSamePassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password cannot be the same as current password' 
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(new_password, salt);
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Server error changing password' });
  }
});


module.exports = router;