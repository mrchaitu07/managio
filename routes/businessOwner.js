const express = require('express');
const router = express.Router();
const BusinessOwner = require('../models/BusinessOwner');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const auth = require('../middleware/auth');

// Helper function to generate OTP
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Validation middleware
const validateSendOTP = [
  body('mobileNumber')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid mobile number is required')
];

const validateVerifyOTP = [
  body('mobileNumber')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid mobile number is required'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
];

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

// Get business owner by ID
router.get('/:id', auth, async (req, res) => {
  try {
    // Check if the authenticated user is authorized to access this profile
    // Convert both to numbers for comparison to handle type differences
    if (parseInt(req.user.id) !== parseInt(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this profile'
      });
    }
    
    const owner = await BusinessOwner.getById(req.params.id);
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Business owner not found'
      });
    }
    res.json({
      success: true,
      data: owner
    });
  } catch (error) {
    console.error('Error fetching business owner:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching business owner',
      error: error.message
    });
  }
});

// Update business owner
router.put('/:id', auth, async (req, res) => {
  try {
    // Check if the authenticated user is authorized to update this profile
    // Convert both to numbers for comparison to handle type differences
    if (parseInt(req.user.id) !== parseInt(req.params.id)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this profile'
      });
    }
    
    const owner = await BusinessOwner.update(req.params.id, req.body);
    res.json({
      success: true,
      data: owner,
      message: 'Business owner updated successfully'
    });
  } catch (error) {
    console.error('Error updating business owner:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating business owner',
      error: error.message
    });
  }
});

module.exports = router;