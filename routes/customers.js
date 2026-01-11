const express = require('express');
const router = express.Router();
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

// Create a new customer
router.post('/', auth, async (req, res) => {
  try {
    const { 
      customer_name, 
      customer_mobile, 
      customer_email, 
      customer_address 
    } = req.body;

    // Validate required fields
    if (!customer_name) {
      return res.status(400).json({
        success: false,
        message: 'Customer name is required'
      });
    }

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can create customers'
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

    // Check if customer already exists with same mobile or email
    if (customer_mobile) {
      const [existingMobile] = await require('../config/db').execute(
        'SELECT id FROM customers WHERE business_id = ? AND customer_mobile = ? AND is_active = TRUE',
        [business_id, customer_mobile]
      );
      if (existingMobile.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this mobile number already exists'
        });
      }
    }

    if (customer_email) {
      const [existingEmail] = await require('../config/db').execute(
        'SELECT id FROM customers WHERE business_id = ? AND customer_email = ? AND is_active = TRUE',
        [business_id, customer_email]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this email already exists'
        });
      }
    }

    // Create the customer
    const customerData = {
      business_id,
      customer_name,
      customer_mobile,
      customer_email,
      customer_address
    };

    const customer = await Customer.create(customerData);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating customer',
      error: error.message
    });
  }
});

// Get all customers for a business
router.get('/', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can view customers'
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

    // Get search query parameter if provided
    const searchTerm = req.query.search;

    let customers;
    if (searchTerm) {
      // Search customers if search term provided
      customers = await Customer.search(business_id, searchTerm);
    } else {
      // Get all customers for the business
      customers = await Customer.findByBusinessId(business_id);
    }

    res.json({
      success: true,
      message: searchTerm ? 'Customers searched successfully' : 'Customers retrieved successfully',
      data: customers,
      count: customers.length
    });
  } catch (error) {
    console.error('Error getting customers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting customers',
      error: error.message
    });
  }
});

// Get a specific customer
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role === 'owner') {
      // Get business ID for the owner
      const business_id = await getBusinessIdFromOwner(req.user.id);
      if (!business_id) {
        return res.status(404).json({
          success: false,
          message: 'Business not found for this owner'
        });
      }

      // Get the customer
      const customer = await Customer.findById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      // Verify the customer belongs to the owner's business
      if (customer.business_id !== business_id) {
        return res.status(403).json({
          success: false,
          message: 'Customer does not belong to your business'
        });
      }

      res.json({
        success: true,
        message: 'Customer retrieved successfully',
        data: customer
      });
    } else if (req.user.role === 'customer') {
      // Allow customer to access their own data
      if (parseInt(id) !== parseInt(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'Customers can only access their own data'
        });
      }

      // Get the customer
      const customer = await Customer.findById(id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }

      res.json({
        success: true,
        message: 'Customer retrieved successfully',
        data: customer
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
  } catch (error) {
    console.error('Error getting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting customer',
      error: error.message
    });
  }
});

// Update a customer
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can update customers'
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

    // Get the customer to verify it exists and belongs to the business
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (existingCustomer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Customer does not belong to your business'
      });
    }

    // Check for duplicate mobile or email if they are being updated
    if (updateData.customer_mobile && updateData.customer_mobile !== existingCustomer.customer_mobile) {
      const [existingMobile] = await require('../config/db').execute(
        'SELECT id FROM customers WHERE business_id = ? AND customer_mobile = ? AND id != ? AND is_active = TRUE',
        [business_id, updateData.customer_mobile, id]
      );
      if (existingMobile.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this mobile number already exists'
        });
      }
    }

    if (updateData.customer_email && updateData.customer_email !== existingCustomer.customer_email) {
      const [existingEmail] = await require('../config/db').execute(
        'SELECT id FROM customers WHERE business_id = ? AND customer_email = ? AND id != ? AND is_active = TRUE',
        [business_id, updateData.customer_email, id]
      );
      if (existingEmail.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer with this email already exists'
        });
      }
    }

    // Update the customer
    const updatedCustomer = await Customer.update(id, updateData);

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating customer',
      error: error.message
    });
  }
});

// Get customer count for a business
router.get('/stats/count', auth, async (req, res) => {
  try {
    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can get customer count'
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

    // Get customer count from the database
    const count = await Customer.getCountByBusinessId(business_id);

    res.json({
      success: true,
      message: 'Customer count retrieved successfully',
      data: { count }
    });
  } catch (error) {
    console.error('Get customer count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get customer count',
      error: error.message
    });
  }
});

// Delete a customer (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is owner
    if (req.user.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only business owners can delete customers'
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

    // Get the customer to verify it exists and belongs to the business
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    if (existingCustomer.business_id !== business_id) {
      return res.status(403).json({
        success: false,
        message: 'Customer does not belong to your business'
      });
    }

    // Delete the customer (soft delete)
    await Customer.delete(id);

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting customer',
      error: error.message
    });
  }
});

// Get customer by customer ID and business ID (for customer view)
router.get('/:customerId/business/:businessId', auth, async (req, res) => {
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
        message: 'Only customers and business owners can view customer details'
      });
    }

    // Get the customer
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Verify the customer belongs to the specified business
    if (customer.business_id != businessId) {
      return res.status(404).json({
        success: false,
        message: 'Customer does not belong to the specified business'
      });
    }

    res.json({
      success: true,
      message: 'Customer retrieved successfully',
      data: customer
    });
  } catch (error) {
    console.error('Error getting customer by ID and business:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while getting customer',
      error: error.message
    });
  }
});

module.exports = router;