const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth'); // This will be for customer authentication

// Get business details by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is a customer
    if (req.user.role === 'customer') {
      // Allow customer to access business details if they exist in that business
      const [customerRows] = await db.execute(
        'SELECT id FROM customers WHERE customer_mobile = ? AND business_id = ? AND is_active = TRUE',
        [req.user.customer_mobile, id]
      );

      if (customerRows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Customer does not have access to this business'
        });
      }
    } else if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only customers and business owners can access business details'
      });
    }

    // For owners, verify they have access to this business
    if (req.user.role === 'owner') {
      if (req.user.business_id !== parseInt(id)) {
        return res.status(403).json({
          success: false,
          message: 'Owner does not have access to this business'
        });
      }
    }

    // Get business details
    const [businessRows] = await db.execute(
      `SELECT b.id, b.business_name, b.business_type, b.business_category, 
              b.address, b.city, b.state, b.pincode, b.logo_url,
              b.created_at, b.updated_at,
              op.full_name as owner_name
       FROM businesses b
       LEFT JOIN owner_profiles op ON b.owner_id = op.user_id
       WHERE b.id = ? AND b.is_active = TRUE`,
      [id]
    );

    if (businessRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }

    res.json({
      success: true,
      message: 'Business details retrieved successfully',
      data: businessRows[0]
    });
  } catch (error) {
    console.error('Error getting business details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting business details',
      error: error.message
    });
  }
});

// Get all businesses where customer exists
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is a customer
    if (req.user.role !== 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can access their businesses'
      });
    }

    // Get all businesses where the customer exists
    const [businessRows] = await db.execute(
      `SELECT b.id, b.business_name, b.business_type, b.business_category, 
              b.address, b.city, b.state, b.pincode, b.logo_url,
              b.created_at, b.updated_at,
              op.full_name as owner_name,
              c.id as customer_id,
              c.customer_name,
              c.customer_mobile,
              c.balance_due,
              c.total_spent
       FROM businesses b
       LEFT JOIN owner_profiles op ON b.owner_id = op.user_id
       LEFT JOIN customers c ON b.id = c.business_id AND c.customer_mobile = ?
       WHERE c.is_active = TRUE
       ORDER BY b.business_name`,
      [req.user.customer_mobile]
    );

    res.json({
      success: true,
      message: 'Businesses retrieved successfully',
      data: businessRows
    });
  } catch (error) {
    console.error('Error getting businesses:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting businesses',
      error: error.message
    });
  }
});

module.exports = router;