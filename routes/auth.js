const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// Helper function to format validation errors
const formatValidationError = (err) => {
  const errors = {};
  
  if (err.errors) {
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
  }
  
  return errors;
};

// Register User
router.post('/register', async (req, res) => {
  const { fullname, email, phone, password, role } = req.body;

  // Basic validation
  if (!fullname || !email || !phone || !password) {
    return res.status(400).json({ 
      msg: 'All fields are required',
      errors: {
        fullname: !fullname ? 'Full name is required' : undefined,
        email: !email ? 'Email is required' : undefined,
        phone: !phone ? 'Phone number is required' : undefined,
        password: !password ? 'Password is required' : undefined,
      }
    });
  }

  try {
    // Check if user already exists by email
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        msg: 'Registration failedse',
        errors: {
          email: 'Email already exists'
        }
      });
    }

    // Check if phone already exists
    existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ 
        msg: 'Registration failed',
        errors: {
          phone: 'Phone number already exists'
        }
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        msg: 'Registration failed',
        errors: {
          password: 'Password must be at least 6 characters'
        }
      });
    }

    // Create new user
    const user = new User({
      fullname: fullname.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role: role || 'user',
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user
    const savedUser = await user.save();

    // Create JWT token
    const payload = {
      user: {
        id: savedUser.id,
        role: savedUser.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) {
          console.error('JWT error:', err);
          return res.status(500).json({ msg: 'Server error creating token' });
        }
        
        res.status(201).json({ 
          success: true,
          message: 'Registration successful',
          token, 
          user: {
            id: savedUser.id,
            fullname: savedUser.fullname,
            email: savedUser.email,
            phone: savedUser.phone,
            role: savedUser.role,
            createdAt: savedUser.createdAt
          }
        });
      }
    );
  } catch (err) {
    console.error('Registration error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = formatValidationError(err);
      return res.status(400).json({ 
        msg: 'Registration faileds',
        errors
      });
    }
    
    // Handle duplicate key error (MongoDB unique constraint)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        msg: 'Registration failed',
        errors: {
          [field]: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
        }
      });
    }
    
    res.status(500).json({ 
      msg: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Login User
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ 
      msg: 'Login failed',
      errors: {
        email: !email ? 'Email is required' : undefined,
        password: !password ? 'Password is required' : undefined,
      }
    });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ 
        msg: 'Login failed',
        errors: {
          email: 'Invalid email or password'
        }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({ 
        msg: 'Login failed',
        errors: {
          email: 'Account is deactivated'
        }
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        msg: 'Login failed',
        errors: {
          password: 'Invalid email or password'
        }
      });
    }

    // Create JWT token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
      (err, token) => {
        if (err) {
          console.error('JWT error:', err);
          return res.status(500).json({ msg: 'Server error creating token' });
        }
        
        res.json({ 
          success: true,
          message: 'Login successful',
          token, 
          user: {
            id: user.id,
            fullname: user.fullname,
            email: user.email,
            phone: user.phone,
            role: user.role,
            createdAt: user.createdAt,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            profileImage: user.profileImage
          }
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      msg: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Protected route example
router.get('/protected', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Admin protected route example
router.get('/admin', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied: Not an admin' });
    }
    res.json({ msg: 'Welcome Admin!', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;