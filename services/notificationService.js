const admin = require('firebase-admin');
const db = require('../config/db');

class NotificationService {
  // Send a notification to a specific user by FCM token
  static async sendNotificationToUser(token, title, body, data = {}) {
    try {
      // For proper notification display in both foreground and background
      // We need to send a message that will trigger system notifications
      const message = {
        // Only include notification payload for system-level notifications
        notification: {
          title: title,
          body: body,
        },
        data: {
          ...data,
          title: title || 'Notification',
          body: body || 'You have a new notification',
          click_action: 'FLUTTER_NOTIFICATION_CLICK', // Legacy property that some systems look for
        },
        token: token,
        android: {
          notification: {
            title: title,
            body: body,
            icon: '@mipmap/ic_launcher', // Use the app launcher icon
            color: '#4285f4', // Accent color for the notification
            channelId: 'default_channel', // Use the channel we created
            sound: 'default', // Sound for Android
            // Importance affects how the notification appears
            visibility: 'public', // Visibility of the notification
            priority: 'high', // Priority of the notification
          },
          // Data specific to Android
          data: {
            ...data,
            title: title,
            body: body,
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: title,
                body: body,
              },
              sound: 'default',
              'content-available': 1, // For background processing
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent message:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to multiple users
  static async sendNotificationToMany(tokens, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data,
        tokens: tokens,
      };

      const response = await admin.messaging().sendMulticast(message);
      console.log('Successfully sent multicast message:', response);
      return { success: true, response };
    } catch (error) {
      console.error('Error sending multicast notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send notification to a topic
  static async sendNotificationToTopic(topic, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: data,
        topic: topic,
      };

      const response = await admin.messaging().send(message);
      console.log('Successfully sent topic message:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending topic notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Subscribe user to a topic
  static async subscribeToTopic(token, topic) {
    try {
      const response = await admin.messaging().subscribeToTopic(token, topic);
      console.log('Successfully subscribed to topic:', response);
      return { success: true, response };
    } catch (error) {
      console.error('Error subscribing to topic:', error);
      return { success: false, error: error.message };
    }
  }

  // Unsubscribe user from a topic
  static async unsubscribeFromTopic(token, topic) {
    try {
      const response = await admin.messaging().unsubscribeFromTopic(token, topic);
      console.log('Successfully unsubscribed from topic:', response);
      return { success: true, response };
    } catch (error) {
      console.error('Error unsubscribing from topic:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's FCM token from database
  static async getUserToken(userId, userType = 'owner') {
    try {
      let query = '';
      let params = [];

      switch (userType) {
        case 'owner':
          query = 'SELECT fcm_token FROM users WHERE id = ?';
          params = [userId];
          break;
        case 'employee':
          query = 'SELECT fcm_token FROM employees WHERE id = ?';
          params = [userId];
          break;
        case 'customer':
          query = 'SELECT fcm_token FROM customers WHERE id = ?';
          params = [userId];
          break;
        default:
          return { success: false, error: 'Invalid user type' };
      }

      const [results] = await db.execute(query, params);

      if (results.length > 0 && results[0].fcm_token) {
        return { success: true, token: results[0].fcm_token };
      } else {
        return { success: false, error: 'FCM token not found for user' };
      }
    } catch (error) {
      console.error('Error getting user token:', error);
      return { success: false, error: error.message };
    }
  }

  // Store user's FCM token in database
  static async storeUserToken(userId, token, userType = 'owner') {
    try {
      let query = '';
      let params = [];

      switch (userType) {
        case 'owner':
          query = 'UPDATE users SET fcm_token = ? WHERE id = ?';
          params = [token, userId];
          break;
        case 'employee':
          query = 'UPDATE employees SET fcm_token = ? WHERE id = ?';
          params = [token, userId];
          break;
        case 'customer':
          query = 'UPDATE customers SET fcm_token = ? WHERE id = ?';
          params = [token, userId];
          break;
        default:
          return { success: false, error: 'Invalid user type' };
      }

      const [result] = await db.execute(query, params);

      if (result.affectedRows > 0) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to update token in database' };
      }
    } catch (error) {
      console.error('Error storing user token:', error);
      return { success: false, error: error.message };
    }
  }

  // Send attendance reminder notification
  static async sendAttendanceReminder(employeeId) {
    try {
      const tokenResult = await this.getUserToken(employeeId, 'employee');
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: 'Attendance Reminder',
          body: 'Don\'t forget to mark your attendance for today!',
        },
        data: {
          type: 'attendance_reminder',
          employeeId: employeeId.toString(),
        },
        token: tokenResult.token,
      };

      const response = await admin.messaging().send(message);
      console.log('Attendance reminder sent:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending attendance reminder:', error);
      return { success: false, error: error.message };
    }
  }

  // Send payment reminder notification
  static async sendPaymentReminder(customerId) {
    try {
      const tokenResult = await this.getUserToken(customerId, 'customer');
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: 'Payment Reminder',
          body: 'You have pending payments. Please check your account.',
        },
        data: {
          type: 'payment_reminder',
          customerId: customerId.toString(),
        },
        token: tokenResult.token,
      };

      const response = await admin.messaging().send(message);
      console.log('Payment reminder sent:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      return { success: false, error: error.message };
    }
  }

  // Send general notification to user
  static async sendGeneralNotification(userId, userType, title, body, data = {}) {
    try {
      const tokenResult = await this.getUserToken(userId, userType);
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          ...data,
          userId: userId.toString(),
          userType: userType,
        },
        token: tokenResult.token,
      };

      const response = await admin.messaging().send(message);
      console.log('General notification sent:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('Error sending general notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;