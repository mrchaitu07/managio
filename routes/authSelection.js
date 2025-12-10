const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');

// Login with user type selection (for users existing in both tables)
router.post('/login-with-type', async (req, res) => {
  try {
    const { mobileNumber, userType } = req.body;
    
    if (!mobileNumber || !userType) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and user type are required'
      });
    }

    // Remove +91 prefix for employee check (employees stored with 10 digits)
    const numberWithoutPrefix = mobileNumber.replace(/^\+91/, '');

    if (userType === 'owner') {
      // Login as owner (with +91 prefix)
      const [owners] = await db.execute(
        'SELECT id, mobile_number, role FROM users WHERE mobile_number = ? AND role = ?',
        [mobileNumber, 'owner']
      );

      if (owners.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Owner not found'
        });
      }

      const payload = {
        user: {
          id: owners[0].id,
          mobile_number: owners[0].mobile_number,
          role: owners[0].role
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        token,
        userType: 'owner',
        user: owners[0]
      });
    } else if (userType === 'employee') {
      // Login as employee (with or without +91 prefix)
      const [employees] = await db.execute(
        'SELECT id, full_name, mobile_number, role, owner_id, joining_date, salary_type, salary_amount FROM employees WHERE (mobile_number = ? OR mobile_number = ?) AND is_active = TRUE',
        [mobileNumber, numberWithoutPrefix]
      );

      if (employees.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      const payload = {
        user: {
          id: employees[0].id,
          mobile_number: employees[0].mobile_number,
          role: 'employee',
          owner_id: employees[0].owner_id
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Get complete employee data including salary information
      const [employeeDetails] = await db.execute(
        'SELECT id, full_name, mobile_number, role, owner_id, joining_date, salary_type, salary_amount FROM employees WHERE id = ?',
        [employees[0].id]
      );
      
      const employeeData = employeeDetails[0] || employees[0];
      
      return res.json({
        success: true,
        token,
        userType: 'employee',
        user: {
          id: employeeData.id,
          full_name: employeeData.full_name,
          mobile_number: employeeData.mobile_number,
          role: employeeData.role,
          owner_id: employeeData.owner_id,
          joining_date: employeeData.joining_date,
          salary_type: employeeData.salary_type,
          salary_amount: employeeData.salary_amount
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }
  } catch (error) {
    console.error('Error logging in with type:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// Check user type (owner or employee)
router.post('/check-user', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Remove +91 prefix for employee check (employees stored with 10 digits)
    const numberWithoutPrefix = mobileNumber.replace(/^\+91/, '');

    // Check if user exists with owner role (with +91 prefix)
    const [owners] = await db.execute(
      'SELECT id, mobile_number, role FROM users WHERE mobile_number = ? AND role = ?',
      [mobileNumber, 'owner']
    );

    // Check if user exists as employee (with or without +91 prefix)
    const [employees] = await db.execute(
      'SELECT id, full_name, mobile_number, role, owner_id, joining_date, salary_type, salary_amount FROM employees WHERE (mobile_number = ? OR mobile_number = ?) AND is_active = TRUE',
      [mobileNumber, numberWithoutPrefix]
    );

    const ownerExists = owners.length > 0;
    const employeeExists = employees.length > 0;

    // If exists in both tables, show selection screen
    if (ownerExists && employeeExists) {
      // Get complete employee data including salary information
      const [employeeDetails] = await db.execute(
        'SELECT id, full_name, mobile_number, role, owner_id, joining_date, salary_type, salary_amount FROM employees WHERE id = ?',
        [employees[0].id]
      );
      
      const employeeData = employeeDetails[0] || employees[0];
      
      return res.json({
        success: true,
        existsInBoth: true,
        ownerData: {
          id: owners[0].id,
          mobile_number: owners[0].mobile_number,
          role: owners[0].role
        },
        employeeData: {
          id: employeeData.id,
          full_name: employeeData.full_name,
          mobile_number: employeeData.mobile_number,
          role: employeeData.role,
          owner_id: employeeData.owner_id,
          joining_date: employeeData.joining_date,
          salary_type: employeeData.salary_type,
          salary_amount: employeeData.salary_amount
        }
      });
    }

    // If exists only as owner
    if (ownerExists) {
      const payload = {
        user: {
          id: owners[0].id,
          mobile_number: owners[0].mobile_number,
          role: owners[0].role
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        exists: true,
        userType: 'owner',
        token,
        user: owners[0]
      });
    }

    // If exists only as employee
    if (employeeExists) {
      const payload = {
        user: {
          id: employees[0].id,
          mobile_number: employees[0].mobile_number,
          role: 'employee',
          owner_id: employees[0].owner_id
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      // Get complete employee data including salary information
      const [employeeDetails] = await db.execute(
        'SELECT id, full_name, mobile_number, role, owner_id, joining_date, salary_type, salary_amount FROM employees WHERE id = ?',
        [employees[0].id]
      );
      
      const employeeData = employeeDetails[0] || employees[0];
      
      return res.json({
        success: true,
        exists: true,
        userType: 'employee',
        token,
        user: {
          id: employeeData.id,
          full_name: employeeData.full_name,
          mobile_number: employeeData.mobile_number,
          role: employeeData.role,
          owner_id: employeeData.owner_id,
          joining_date: employeeData.joining_date,
          salary_type: employeeData.salary_type,
          salary_amount: employeeData.salary_amount
        }
      });
    }

    // User doesn't exist in either table
    return res.json({
      success: true,
      exists: false
    });
  } catch (error) {
    console.error('Error checking user:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking user',
      error: error.message
    });
  }
});

// Check if user exists with owner role (kept for backward compatibility)
router.post('/check-owner', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    // Check if user exists with owner role
    const [users] = await db.execute(
      'SELECT id, mobile_number, role FROM users WHERE mobile_number = ? AND role = ?',
      [mobileNumber, 'owner']
    );

    if (users.length > 0) {
      // User exists as owner, generate token
      const payload = {
        user: {
          id: users[0].id,
          mobile_number: users[0].mobile_number,
          role: users[0].role
        }
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.json({
        success: true,
        exists: true,
        token,
        user: users[0]
      });
    }

    // User doesn't exist as owner
    return res.json({
      success: true,
      exists: false
    });
  } catch (error) {
    console.error('Error checking owner:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking user',
      error: error.message
    });
  }
});

// Send OTP to mobile number
router.post('/send-otp', async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }
    
    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, you would send this OTP via SMS
    console.log(`OTP for ${mobileNumber}: ${otp}`);
    
    // Save OTP to database with expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
    
    await db.execute(
      'INSERT INTO otp_verifications (mobile_number, otp, expires_at) VALUES (?, ?, ?)',
      [mobileNumber, otp, expiresAt]
    );

    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      // In production, don't send OTP in response
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;
    
    if (!mobileNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and OTP are required'
      });
    }
    
    // Check if OTP is valid and not expired
    const [otpRecords] = await db.execute(
      'SELECT * FROM otp_verifications WHERE mobile_number = ? AND otp = ? AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [mobileNumber, otp]
    );

    if (otpRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Mark OTP as used
    await db.execute(
      'UPDATE otp_verifications SET is_used = 1 WHERE id = ?',
      [otpRecords[0].id]
    );

    // Check if user already exists and return token
    const [existingUsers] = await db.execute(
      'SELECT id, mobile_number, role FROM users WHERE mobile_number = ?',
      [mobileNumber]
    );

    let token = null;
    if (existingUsers.length > 0) {
      // User exists, generate token
      const payload = {
        user: {
          id: existingUsers[0].id,
          mobile_number: existingUsers[0].mobile_number,
          role: existingUsers[0].role
        }
      };

      token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );
    }

    res.json({ 
      success: true, 
      message: 'OTP verified successfully',
      token,
      userExists: existingUsers.length > 0
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message
    });
  }
});

module.exports = router;