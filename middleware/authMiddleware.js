// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token') || req.header('Authorization');

  // Check if no token
  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'No token, authorization denied' 
    });
  }

  try {
    // Remove 'Bearer ' if present
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    // Verify token
    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
    
    console.log('Auth middleware - Decoded user:', decoded);
    
    // NORMALIZE THE STRUCTURE
    // If token has { user: { id, role } }, flatten it
    if (decoded.user && decoded.user.id) {
      req.user = {
        id: decoded.user.id,        // Make it accessible as req.user.id
        role: decoded.user.role,    // Make it accessible as req.user.role
        original: decoded           // Keep original for reference
      };
      console.log('Normalized to flat structure:', req.user);
    } else {
      // If token already has flat structure { id, role }
      req.user = decoded;
    }
    
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    res.status(401).json({ 
      success: false,
      message: 'Token is not valid' 
    });
  }
};