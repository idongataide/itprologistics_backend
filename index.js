require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
// app.use(cors({
//   origin: process.env.NODE_ENV === 'production' 
//     ? ['https://itprologistics-backend.onrender.com'] 
//     : ['http://localhost:5000'],
//   credentials: true
// }));
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
  console.error('MongoDB connection error:', err.message);
  process.exit(1); 
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/admin/user'));
app.use('/api', require('./routes/admin/driver'));
app.use('/api/driver', require('./routes/driver'));
app.use('/api', require('./routes/admin/vehicle'));
app.use('/api', require('./routes/admin/rides'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api', require('./routes/user'));

// Charter Routes
app.use('/api/admin/charter', require('./routes/admin/charter/charterDriver'));
app.use('/api/admin/charter', require('./routes/admin/charter/CharterVehicle'));
app.use('/api/admin/charter', require('./routes/admin/charter/charterOrder'));
app.use('/api/charter', require('./routes/charter'));
app.use('/api/charter', require('./routes/charterVehicles'));

// Basic Route
app.get('/', (req, res) => {
  res.json({ 
    message: 'API is running...',
    status: 'healthy'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'itprologistics-backend'
  });
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.message);
  console.error('Error stack:', err.stack);
  
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});