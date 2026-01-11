const express = require('express');
const router = express.Router();
const BusinessOwner = require('../models/BusinessOwner');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Validation middleware
const validateOnboarding = [
  body('mobileNumber')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid mobile number is required'),
  body('fullName')
    .notEmpty()
    .withMessage('Full name is required'),
  body('businessName')
    .notEmpty()
    .withMessage('Business name is required'),
  body('businessType')
    .optional()
    .isString(),
  body('businessCategory')
    .optional()
    .isString(),
  body('address')
    .optional()
    .isString(),
  body('city')
    .optional()
    .isString(),
  body('state')
    .optional()
    .isString(),
  body('pincode')
    .optional()
    .isPostalCode('IN'),
  body('businessRole')
    .optional()
    .isString(),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('dateOfBirth')
    .optional()
    .isISO8601(),
  body('attendanceMethod')
    .optional()
    .isIn(['qr_scan', 'location', 'manual']),
  body('startTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('endTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/),
  body('weeklyOff')
    .optional()
    .isString(),
  body('salaryCycle')
    .optional()
    .isIn(['weekly', 'bi_weekly', 'monthly', 'yearly']), // Added 'yearly' option
  body('location')
    .optional()
    .isObject(),
  body('location.latitude')
    .if(body('location').exists())
    .isFloat({ min: -90, max: 90 }),
  body('location.longitude')
    .if(body('location').exists())
    .isFloat({ min: -180, max: 180 })
];

// Complete onboarding
router.post('/onboard', validateOnboarding, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  try {
    const { mobileNumber } = req.body;
    
    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id, role FROM users WHERE mobile_number = ?',
      [mobileNumber]
    );

    let owner;
    if (existingUsers.length > 0) {
      // User already exists - check if they're an employee
      const existingUser = existingUsers[0];
      
      if (existingUser.role === 'employee') {
        // Update the user's role to owner and create business profile
        // We'll still call the BusinessOwner.create method but need to handle this differently
        
        // First, update the user's role to owner
        await db.execute(
          'UPDATE users SET role = ? WHERE id = ?',
          ['owner', existingUser.id]
        );
        
        // Then create the business owner profile with the existing user ID
        // We need to modify the create method to handle existing user IDs
        const {
          fullName,
          businessName,
          businessType,
          businessCategory,
          address,
          city,
          state,
          pincode,
          businessRole,
          gender,
          dateOfBirth,
          attendanceMethod,
          startTime,
          endTime,
          weeklyOff,
          salaryCycle,
          location
        } = req.body;
        
        // Create profile, business, and settings for the existing user
        const connection = await db.getConnection();
        try {
          await connection.beginTransaction();

          // Create owner profile
          const [profileResult] = await connection.execute(
            `INSERT INTO owner_profiles (
              user_id, full_name, business_role, gender, date_of_birth
            ) VALUES (?, ?, ?, ?, ?)`,
            [
              existingUser.id, 
              fullName, 
              businessRole || null, 
              gender || null, 
              dateOfBirth || null
            ]
          );

          // Create business
          const [businessResult] = await connection.execute(
            `INSERT INTO businesses (
              owner_id, business_name, business_type, business_category, 
              address, city, state, pincode, latitude, longitude
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existingUser.id,
              businessName,
              businessType || null,
              businessCategory || null,
              address || null,
              city || null,
              state || null,
              pincode || null,
              location ? location.latitude : null,
              location ? location.longitude : null
            ]
          );

          const businessId = businessResult.insertId;

          // Create business settings
          const [settingsResult] = await connection.execute(
            `INSERT INTO business_settings (
              business_id, attendance_method, work_start_time, work_end_time, 
              weekly_off_days, salary_cycle
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              businessId,
              attendanceMethod || 'qr_scan',
              startTime || '09:00:00',
              endTime || '17:00:00',
              weeklyOff || null,
              salaryCycle || 'monthly'
            ]
          );

          await connection.commit();

          // Return the complete owner object
          owner = {
            id: existingUser.id,
            mobile_number: mobileNumber,
            role: 'owner',
            profile: {
              id: profileResult.insertId,
              user_id: existingUser.id,
              full_name: fullName,
              business_role: businessRole || null,
              gender: gender || null,
              date_of_birth: dateOfBirth || null
            },
            business: {
              id: businessId,
              owner_id: existingUser.id,
              business_name: businessName,
              business_type: businessType || null,
              business_category: businessCategory || null,
              address: address || null,
              city: city || null,
              state: state || null,
              pincode: pincode || null,
              latitude: location ? location.latitude : null,
              longitude: location ? location.longitude : null
            }
          };
        } catch (error) {
          await connection.rollback();
          console.error('Error updating employee to business owner:', error);
          throw error;
        } finally {
          connection.release();
        }
      } else {
        // User already exists as an owner
        return res.status(400).json({
          success: false,
          message: 'User with this mobile number is already registered as an owner'
        });
      }
    } else {
      // Create new business owner (original flow)
      owner = await BusinessOwner.create(req.body);
    }
    
    // Generate JWT token
    const payload = {
      user: {
        id: owner.id,
        mobile_number: owner.mobile_number,
        role: owner.role
      }
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.status(201).json({
      success: true,
      data: owner,
      token,
      message: 'Business owner onboarded successfully'
    });
  } catch (error) {
    console.error('Error during onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Error during onboarding',
      error: error.message
    });
  }
});

module.exports = router;