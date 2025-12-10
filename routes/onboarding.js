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
      'SELECT id FROM users WHERE mobile_number = ?',
      [mobileNumber]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this mobile number already exists'
      });
    }

    // Create new business owner
    const owner = await BusinessOwner.create(req.body);
    
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