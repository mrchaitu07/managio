const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

// Add a new payment
router.post('/add', auth, async (req, res) => {
  try {
    const ownerId = req.user.id; // Get owner ID from authenticated user
    const { employeeId, paymentDate, amount, note } = req.body;

    // Validation
    if (!employeeId || !paymentDate || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide employeeId, paymentDate, and amount'
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

    const paymentData = {
      ownerId,
      employeeId,
      paymentDate,
      amount: parsedAmount,
      note: note || null
    };

    const paymentId = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      message: 'Payment added successfully',
      data: {
        paymentId
      }
    });

  } catch (error) {
    console.error('Add payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment',
      error: error.message
    });
  }
});

// Get all payments for an employee
router.get('/employee/:employeeId', auth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const { employeeId } = req.params;

    const payments = await Payment.getByEmployeeId(employeeId);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get employee payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// Get all payments for the business owner
router.get('/owner', auth, async (req, res) => {
  try {
    const ownerId = req.user.id;

    const payments = await Payment.getByOwnerId(ownerId);

    res.status(200).json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get owner payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// Get payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.getById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment',
      error: error.message
    });
  }
});

// Update payment
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, amount, note } = req.body;

    // Validation
    if (!paymentDate || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide paymentDate and amount'
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

    const paymentData = {
      paymentDate,
      amount: parsedAmount,
      note: note || null
    };

    const updated = await Payment.update(id, paymentData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully'
    });

  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment',
      error: error.message
    });
  }
});

// Delete payment
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Payment.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully'
    });

  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment',
      error: error.message
    });
  }
});

module.exports = router;