require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Test DB Connection
db.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL:', err);
    process.exit(1); // Exit if we can't connect to the database
  });

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Managio API' });
});

// Auth routes
app.use('/api/auth', require('./routes/auth'));

// User routes (protected)
app.use('/api/users', require('./routes/users'));

// Business Owner routes
app.use('/api/business-owners', require('./routes/businessOwner'));

// Business Settings routes
app.use('/api/business-settings', require('./routes/businessSettings'));

// Employee routes
app.use('/api/employees', require('./routes/employee'));

// Attendance routes
app.use('/api/attendance', require('./routes/attendance'));

// Authentication selection routes
app.use('/api/auth-selection', require('./routes/authSelection'));

// Onboarding routes
app.use('/api/onboarding', require('./routes/onboarding'));

// Employee attendance routes
app.use('/api/employee-attendance', require('./routes/employeeAttendance'));

// Employee business settings routes
app.use('/api/employee-business-settings', require('./routes/employeeBusinessSettings'));

// Payment routes
app.use('/api/payments', require('./routes/payments'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});