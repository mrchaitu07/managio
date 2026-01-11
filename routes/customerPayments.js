const express = require('express');
const router = express.Router();
const CustomerPayment = require('../models/CustomerPayment');
const Customer = require('../models/Customer');
const BusinessOwner = require('../models/BusinessOwner');
const auth = require('../middleware/auth');

// Get business ID for the authenticated owner
async function getBusinessIdFromOwner(ownerId) {
  try {
    const [rows] = await require('../config/db').execute(
      `SELECT b.id as business_id 
       FROM businesses b 
       WHERE b.owner_id = ?`,
      [ownerId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0].business_id;
  } catch (error) {
    console.error('Error getting business ID:', error);
    throw error;
  }
}

// Add a new customer payment
router.post('/add', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can add customer payments'
      });
    }

    const ownerId = req.user.id;
    const { customerId, amount, paymentMethod, paymentDate, notes } = req.body;

    // Validation
    if (!customerId || !amount || !paymentMethod || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customerId, amount, paymentMethod, and paymentDate'
      });
    }

    // Validate amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get business ID for the owner
    const business_id = await getBusinessIdFromOwner(ownerId);
    if (!business_id) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this owner'
      });
    }

    // Verify the customer belongs to the owner's business
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Customer does not belong to your business'
      });
    }

    const paymentData = {
      customer_id: customerId,
      amount: parsedAmount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      notes: notes || null
    };

    const payment = await CustomerPayment.create(paymentData);

    res.status(201).json({
      success: true,
      message: 'Customer payment added successfully',
      data: payment
    });

  } catch (error) {
    console.error('Add customer payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customer payment',
      error: error.message
    });
  }
});

// Get all payments for a customer
router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer payments'
      });
    }

    // Get business ID for the owner
    const business_id = await getBusinessIdFromOwner(req.user.id);
    if (!business_id) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this owner'
      });
    }

    // Verify the customer belongs to the owner's business
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Customer does not belong to your business'
      });
    }

    const payments = await CustomerPayment.findByCustomerId(customerId);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get customer payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer payments',
      error: error.message
    });
  }
});

// Get all payments for the business owner
router.get('/owner', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer payments'
      });
    }

    const payments = await CustomerPayment.findByOwnerId(req.user.id);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get owner customer payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer payments',
      error: error.message
    });
  }
});

// Get customer payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer payments'
      });
    }

    // Get business ID for the owner
    const business_id = await getBusinessIdFromOwner(req.user.id);
    if (!business_id) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this owner'
      });
    }

    const payment = await CustomerPayment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment's customer belongs to the owner's business
    const customer = await Customer.findById(payment.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Payment does not belong to your business'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Get customer payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer payment',
      error: error.message
    });
  }
});

// Update customer payment
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, paymentDate, notes } = req.body;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can update customer payments'
      });
    }

    // Validation
    if (!amount || !paymentMethod || !paymentDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount, paymentMethod, and paymentDate'
      });
    }

    // Validate amount is a positive number
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    // Get business ID for the owner
    const business_id = await getBusinessIdFromOwner(req.user.id);
    if (!business_id) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this owner'
      });
    }

    const payment = await CustomerPayment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment's customer belongs to the owner's business
    const customer = await Customer.findById(payment.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Payment does not belong to your business'
      });
    }

    const paymentData = {
      amount: parsedAmount,
      payment_method: paymentMethod,
      payment_date: paymentDate,
      notes: notes || null
    };

    const updated = await CustomerPayment.update(id, paymentData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer payment updated successfully'
    });

  } catch (error) {
    console.error('Update customer payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer payment',
      error: error.message
    });
  }
});

// Delete customer payment
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can delete customer payments'
      });
    }

    // Get business ID for the owner
    const business_id = await getBusinessIdFromOwner(req.user.id);
    if (!business_id) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this owner'
      });
    }

    const payment = await CustomerPayment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Verify the payment's customer belongs to the owner's business
    const customer = await Customer.findById(payment.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Payment does not belong to your business'
      });
    }

    const deleted = await CustomerPayment.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer payment deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer payment',
      error: error.message
    });
  }
});

// Get all payments for a customer in a specific business
router.get('/customer/:customerId/business/:businessId', auth, async (req, res) => {
  try {
    const { customerId, businessId } = req.params;

    // Check if user is a customer
    if (req.user.role === 'customer') {
      // Allow customer to access their own data for the specific business
      if (req.user.customer_mobile) {
        const db = require('../config/db');
        const [customerRows] = await db.execute(
          'SELECT id FROM customers WHERE customer_mobile = ? AND business_id = ? AND id = ? AND is_active = TRUE',
          [req.user.customer_mobile, businessId, customerId]
        );

        if (customerRows.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Customer does not have access to this customer data in this business'
          });
        }
      }
    } else if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only customers and business owners can view customer payments'
      });
    }

    // For owners, verify they have access to this business
    if (req.user.role === 'owner') {
      if (req.user.business_id !== parseInt(businessId)) {
        return res.status(403).json({
          success: false,
          message: 'Owner does not have access to this business'
        });
      }
    }

    const payments = await CustomerPayment.findByCustomerIdAndBusinessId(customerId, businessId);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get customer payments for business error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer payments',
      error: error.message
    });
  }
});

module.exports = router;