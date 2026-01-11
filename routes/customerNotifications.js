const express = require('express');
const router = express.Router();
const db = require('../config/db');
const NotificationService = require('../services/notificationService');

// Send notification to a specific customer
router.post('/send', async (req, res) => {
  try {
    const { customerId, title, body } = req.body;

    // Validation
    if (!customerId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID, title, and body are required'
      });
    }

    // Verify customer exists and get their FCM token
    const [customerResults] = await db.execute(
      'SELECT id, customer_name, customer_mobile, fcm_token FROM customers WHERE id = ? AND is_active = TRUE',
      [customerId]
    );

    if (customerResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customer = customerResults[0];
    
    if (!customer.fcm_token) {
      return res.status(400).json({
        success: false,
        message: 'Customer does not have an FCM token registered'
      });
    }

    // Send notification to customer
    const notificationResult = await NotificationService.sendNotificationToUser(
      customer.fcm_token,
      title,
      body,
      {
        type: 'customer_notification',
        customerId: customerId.toString(),
        timestamp: new Date().toISOString()
      }
    );

    if (notificationResult.success) {
      res.json({
        success: true,
        message: 'Notification sent successfully',
        messageId: notificationResult.messageId
      });
    } else {
      // Check if the error is due to invalid token
      if (notificationResult.error && 
          (notificationResult.error.includes('registration-token-not-registered') || 
           notificationResult.error.includes('not found'))) {
        // Clear the invalid token from the database
        try {
          await db.execute(
            'UPDATE customers SET fcm_token = NULL WHERE id = ?',
            [customerId]
          );
          console.log(`Cleared invalid FCM token for customer ${customerId}`);
          
          res.status(400).json({
            success: false,
            message: 'Customer needs to update their notification token'
          });
        } catch (updateError) {
          console.error('Error clearing invalid token:', updateError);
          res.status(500).json({
            success: false,
            message: 'Failed to send notification and error updating token',
            error: notificationResult.error
          });
        }
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to send notification',
          error: notificationResult.error
        });
      }
    }
  } catch (error) {
    console.error('Error sending customer notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending customer notification',
      error: error.message
    });
  }
});

module.exports = router;