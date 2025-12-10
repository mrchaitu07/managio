const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get business settings for an employee's employer
router.get('/', auth, async (req, res) => {
  try {
    console.log('Employee business settings request received for user:', req.user);
    
    // This endpoint is for employees to get their employer's business settings
    if (req.user.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'This endpoint is only for employees'
      });
    }

    const employeeId = req.user.id;
    console.log('Employee ID:', employeeId);

    // Get the employee's owner_id
    const [employees] = await db.execute(
      'SELECT owner_id FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    console.log('Employee query result:', employees);

    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const ownerId = employees[0].owner_id;
    console.log('Owner ID:', ownerId);

    // Get the business for this owner with location data
    const [businesses] = await db.execute(
      'SELECT id, business_name, latitude, longitude FROM businesses WHERE owner_id = ? AND is_active = TRUE',
      [ownerId]
    );
    
    console.log('Business query result:', businesses);

    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this employee'
      });
    }

    const business = businesses[0];
    const businessId = business.id;
    console.log('Business data:', business);

    // Get business settings
    const [settings] = await db.execute(
      'SELECT * FROM business_settings WHERE business_id = ?',
      [businessId]
    );
    
    console.log('Settings query result:', settings);

    if (settings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business settings not found'
      });
    }

    // Return the business settings along with business location data
    const responseData = {
      success: true,
      data: {
        business_id: businessId,
        owner_id: ownerId,
        business: {
          id: business.id,
          business_name: business.business_name,
          latitude: business.latitude,
          longitude: business.longitude
        },
        settings: settings[0]
      }
    };
    
    console.log('Final response data:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching employee business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching business settings',
      error: error.message
    });
  }
});

module.exports = router;