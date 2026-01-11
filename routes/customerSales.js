const express = require('express');
const router = express.Router();
const CustomerSale = require('../models/CustomerSale');
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

// Add a new customer sale
router.post('/add', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can add customer sales'
      });
    }

    const ownerId = req.user.id;
    const { customerId, productName, quantity, price, totalAmount, saleDate, notes } = req.body;

    // Validation
    if (!customerId || !productName || !quantity || !price || !totalAmount || !saleDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide customerId, productName, quantity, price, totalAmount, and saleDate'
      });
    }

    // Validate quantity is a positive number
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Validate price and totalAmount are positive numbers
    const parsedPrice = parseFloat(price);
    const parsedTotalAmount = parseFloat(totalAmount);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedTotalAmount) || parsedTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price and total amount must be positive numbers'
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

    const saleData = {
      customer_id: customerId,
      product_name: productName,
      quantity: parsedQuantity,
      price: parsedPrice,
      total_amount: parsedTotalAmount,
      sale_date: saleDate,
      notes: notes || null
    };

    const sale = await CustomerSale.create(saleData);

    res.status(201).json({
      success: true,
      message: 'Customer sale added successfully',
      data: sale
    });

  } catch (error) {
    console.error('Add customer sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customer sale',
      error: error.message
    });
  }
});

// Get all sales for a customer
router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer sales'
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

    const sales = await CustomerSale.findByCustomerId(customerId);

    res.status(200).json({
      success: true,
      data: sales
    });

  } catch (error) {
    console.error('Get customer sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer sales',
      error: error.message
    });
  }
});

// Get all sales for the business owner
router.get('/owner', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer sales'
      });
    }

    const sales = await CustomerSale.findByOwnerId(req.user.id);

    res.status(200).json({
      success: true,
      data: sales
    });

  } catch (error) {
    console.error('Get owner customer sales error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer sales',
      error: error.message
    });
  }
});

// Get customer sale by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customer sales'
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

    const sale = await CustomerSale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Verify the sale's customer belongs to the owner's business
    const customer = await Customer.findById(sale.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Sale does not belong to your business'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });

  } catch (error) {
    console.error('Get customer sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer sale',
      error: error.message
    });
  }
});

// Update customer sale
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { productName, quantity, price, totalAmount, saleDate, notes } = req.body;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can update customer sales'
      });
    }

    // Validation
    if (!productName || !quantity || !price || !totalAmount || !saleDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide productName, quantity, price, totalAmount, and saleDate'
      });
    }

    // Validate quantity is a positive number
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Validate price and totalAmount are positive numbers
    const parsedPrice = parseFloat(price);
    const parsedTotalAmount = parseFloat(totalAmount);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || isNaN(parsedTotalAmount) || parsedTotalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price and total amount must be positive numbers'
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

    const sale = await CustomerSale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Verify the sale's customer belongs to the owner's business
    const customer = await Customer.findById(sale.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Sale does not belong to your business'
      });
    }

    const saleData = {
      product_name: productName,
      quantity: parsedQuantity,
      price: parsedPrice,
      total_amount: parsedTotalAmount,
      sale_date: saleDate,
      notes: notes || null
    };

    const updated = await CustomerSale.update(id, saleData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer sale updated successfully'
    });

  } catch (error) {
    console.error('Update customer sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer sale',
      error: error.message
    });
  }
});

// Delete customer sale
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can delete customer sales'
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

    const sale = await CustomerSale.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Verify the sale's customer belongs to the owner's business
    const customer = await Customer.findById(sale.customer_id);
    if (!customer || customer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Sale does not belong to your business'
      });
    }

    const deleted = await CustomerSale.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Customer sale deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer sale error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer sale',
      error: error.message
    });
  }
});

// Get all sales for a customer in a specific business
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
        message: 'Only customers and business owners can view customer sales'
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

    const sales = await CustomerSale.findByCustomerIdAndBusinessId(customerId, businessId);

    res.status(200).json({
      success: true,
      data: sales
    });

  } catch (error) {
    console.error('Get customer sales for business error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer sales',
      error: error.message
    });
  }
});

module.exports = router;