const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get business settings by business ID
router.get('/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    console.log('Fetching business settings for businessId:', businessId, 'and userId:', req.user.id);
    
    // Verify that the business belongs to the authenticated owner
    const [businesses] = await db.execute(
      'SELECT id, owner_id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );
    
    console.log('Businesses found:', businesses);
    
    if (businesses.length === 0) {
      // Let's also check if the business exists but doesn't belong to this owner
      const [allBusinesses] = await db.execute(
        'SELECT id, owner_id FROM businesses WHERE id = ?',
        [businessId]
      );
      
      console.log('All businesses with this ID:', allBusinesses);
      
      if (allBusinesses.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Business found but does not belong to the authenticated user'
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }
    
    // Get business settings
    const [settings] = await db.execute(
      'SELECT * FROM business_settings WHERE business_id = ?',
      [businessId]
    );
    
    console.log('Settings found:', settings);
    
    if (settings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business settings not found'
      });
    }
    
    // Return both business and settings data
    res.json({
      success: true,
      data: {
        business: businesses[0],
        settings: settings[0]
      }
    });
  } catch (error) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching business settings',
      error: error.message
    });
  }
});

// Update business settings
router.put('/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const updateData = req.body;
    
    // Verify that the business belongs to the authenticated owner
    const [businesses] = await db.execute(
      'SELECT id, owner_id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );
    
    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }
    
    // Update business settings
    const settingsUpdates = {};
    const settingsFields = [
      'attendance_method', 'work_start_time', 'work_end_time',
      'weekly_off_days', 'salary_cycle'
    ];
    
    settingsFields.forEach(field => {
      if (updateData[field] !== undefined) {
        settingsUpdates[field] = updateData[field];
      }
    });
    
    if (Object.keys(settingsUpdates).length > 0) {
      const settingsSetClause = Object.keys(settingsUpdates).map(key => `${key} = ?`).join(', ');
      const settingsValues = [...Object.values(settingsUpdates), businessId];
      
      await db.execute(
        `UPDATE business_settings SET ${settingsSetClause} WHERE business_id = ?`,
        settingsValues
      );
    }
    
    // Get updated settings
    const [settings] = await db.execute(
      'SELECT * FROM business_settings WHERE business_id = ?',
      [businessId]
    );
    
    res.json({
      success: true,
      data: settings[0],
      message: 'Business settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating business settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating business settings',
      error: error.message
    });
  }
});

module.exports = router;