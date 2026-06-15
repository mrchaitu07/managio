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
  static async storeUserToken(userId, token, userType = 'owner', businessId = null) {
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
          // For customers, always store token for all businesses where this customer exists
          // This ensures they receive notifications from all associated businesses
          // First get the customer mobile number
          const [customerData] = await db.execute(
            'SELECT customer_mobile FROM customers WHERE id = ? LIMIT 1',
            [userId]
          );
          
          if (customerData.length === 0) {
            return { success: false, error: 'Customer not found' };
          }
          
          const customerMobile = customerData[0].customer_mobile;
          
          // Update all customers with the same mobile number
          query = 'UPDATE customers SET fcm_token = ? WHERE customer_mobile = ?';
          params = [token, customerMobile];
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
      // For customers, we need to send notifications to all businesses where they exist
      // First, get all customer records with the same mobile number
      const [customerRecords] = await db.execute(
        'SELECT id, customer_mobile, business_id, fcm_token FROM customers WHERE customer_mobile = (SELECT customer_mobile FROM customers WHERE id = ? LIMIT 1) AND is_active = TRUE AND fcm_token IS NOT NULL',
        [customerId]
      );
      
      if (customerRecords.length === 0) {
        return { success: false, error: 'Customer FCM tokens not found' };
      }
      
      // Send notification to each business where customer exists
      const results = [];
      for (const customer of customerRecords) {
        if (customer.fcm_token) {
          const message = {
            notification: {
              title: 'Payment Reminder',
              body: 'You have pending payments. Please check your account.',
            },
            data: {
              type: 'payment_reminder',
              customerId: customer.id.toString(),
              businessId: customer.business_id.toString(),
            },
            token: customer.fcm_token,
          };
          
          try {
            const response = await admin.messaging().send(message);
            console.log(`Payment reminder sent to business ${customer.business_id}:`, response);
            results.push({ businessId: customer.business_id, success: true, messageId: response });
          } catch (sendError) {
            console.error(`Failed to send payment reminder to business ${customer.business_id}:`, sendError);
            results.push({ businessId: customer.business_id, success: false, error: sendError.message });
          }
        }
      }
      
      return { 
        success: results.some(r => r.success), 
        results: results,
        message: 'Payment reminders sent to all businesses'
      };
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

  // Send test notification
  static async sendTestNotification(userId, userType, title, body) {
    try {
      const tokenResult = await this.getUserToken(userId, userType);
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: title || 'Test Notification',
          body: body || 'This is a test notification from Managio',
        },
        data: {
          type: 'test_notification',
          userId: userId.toString(),
          userType: userType,
          timestamp: new Date().toISOString(),
        },
        token: tokenResult.token,
        android: {
          notification: {
            title: title || 'Test Notification',
            body: body || 'This is a test notification from Managio',
            icon: '@mipmap/ic_launcher',
            color: '#4285f4',
            channelId: 'default_channel',
            sound: 'default',
            visibility: 'public',
            priority: 'high',
          },
          data: {
            type: 'test_notification',
            userId: userId.toString(),
            userType: userType,
            timestamp: new Date().toISOString(),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: title || 'Test Notification',
                body: body || 'This is a test notification from Managio',
              },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Test notification sent:', response);
      return { 
        success: true, 
        messageId: response,
        message: 'Test notification sent successfully'
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send attendance update notification to employee
  static async sendAttendanceUpdateNotification(employeeId, status, date, time) {
    try {
      const tokenResult = await this.getUserToken(employeeId, 'employee');
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: 'Attendance Updated',
          body: `Your attendance has been updated to ${status} for ${date} at ${time}`,
        },
        data: {
          type: 'attendance_update',
          employeeId: employeeId.toString(),
          status: status,
          date: date,
          time: time,
          timestamp: new Date().toISOString(),
        },
        token: tokenResult.token,
        android: {
          notification: {
            title: 'Attendance Updated',
            body: `Your attendance has been updated to ${status} for ${date} at ${time}`,
            icon: '@mipmap/ic_launcher',
            color: '#4285f4',
            channelId: 'default_channel',
            sound: 'default',
            visibility: 'public',
            priority: 'high',
          },
          data: {
            type: 'attendance_update',
            employeeId: employeeId.toString(),
            status: status,
            date: date,
            time: time,
            timestamp: new Date().toISOString(),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Attendance Updated',
                body: `Your attendance has been updated to ${status} for ${date} at ${time}`,
              },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Attendance update notification sent:', response);
      return { 
        success: true, 
        messageId: response,
        message: 'Attendance update notification sent successfully'
      };
    } catch (error) {
      console.error('Error sending attendance update notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send attendance mark notification to employee
  static async sendAttendanceMarkNotification(employeeId, status, date, time) {
    try {
      const tokenResult = await this.getUserToken(employeeId, 'employee');
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: 'Attendance Marked',
          body: `Your attendance has been marked as ${status} for ${date} at ${time}`,
        },
        data: {
          type: 'attendance_mark',
          employeeId: employeeId.toString(),
          status: status,
          date: date,
          time: time,
          timestamp: new Date().toISOString(),
        },
        token: tokenResult.token,
        android: {
          notification: {
            title: 'Attendance Marked',
            body: `Your attendance has been marked as ${status} for ${date} at ${time}`,
            icon: '@mipmap/ic_launcher',
            color: '#4285f4',
            channelId: 'default_channel',
            sound: 'default',
            visibility: 'public',
            priority: 'high',
          },
          data: {
            type: 'attendance_mark',
            employeeId: employeeId.toString(),
            status: status,
            date: date,
            time: time,
            timestamp: new Date().toISOString(),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Attendance Marked',
                body: `Your attendance has been marked as ${status} for ${date} at ${time}`,
              },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Attendance mark notification sent:', response);
      return { 
        success: true, 
        messageId: response,
        message: 'Attendance mark notification sent successfully'
      };
    } catch (error) {
      console.error('Error sending attendance mark notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send attendance notification to owner (when employee marks attendance)
  static async sendEmployeeAttendanceNotification(ownerId, employeeName, status, date, time) {
    try {
      const tokenResult = await this.getUserToken(ownerId, 'owner');
      if (!tokenResult.success) {
        return tokenResult;
      }

      const message = {
        notification: {
          title: 'Employee Attendance',
          body: `${employeeName} marked attendance as ${status} on ${date} at ${time}`,
        },
        data: {
          type: 'employee_attendance',
          ownerId: ownerId.toString(),
          employeeName: employeeName,
          status: status,
          date: date,
          time: time,
          timestamp: new Date().toISOString(),
        },
        token: tokenResult.token,
        android: {
          notification: {
            title: 'Employee Attendance',
            body: `${employeeName} marked attendance as ${status} on ${date} at ${time}`,
            icon: '@mipmap/ic_launcher',
            color: '#4285f4',
            channelId: 'default_channel',
            sound: 'default',
            visibility: 'public',
            priority: 'high',
          },
          data: {
            type: 'employee_attendance',
            ownerId: ownerId.toString(),
            employeeName: employeeName,
            status: status,
            date: date,
            time: time,
            timestamp: new Date().toISOString(),
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: 'Employee Attendance',
                body: `${employeeName} marked attendance as ${status} on ${date} at ${time}`,
              },
              sound: 'default',
              'content-available': 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log('Employee attendance notification sent to owner:', response);
      return { 
        success: true, 
        messageId: response,
        message: 'Employee attendance notification sent to owner successfully'
      };
    } catch (error) {
      console.error('Error sending employee attendance notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Send holiday notification to all employees of a business
  static async sendHolidayNotification(businessId, holidayDate, description) {
    try {
      // Get all active employees for the business
      const [employees] = await db.execute(
        'SELECT id, fcm_token FROM employees WHERE owner_id = (SELECT owner_id FROM businesses WHERE id = ?) AND is_active = TRUE AND fcm_token IS NOT NULL',
        [businessId]
      );
      
      if (employees.length === 0) {
        return { success: true, message: 'No employees found with FCM tokens' };
      }
      
      // Collect valid FCM tokens
      const validTokens = employees
        .filter(employee => employee.fcm_token)
        .map(employee => employee.fcm_token);
      
      if (validTokens.length === 0) {
        return { success: true, message: 'No employees have FCM tokens registered' };
      }
      
      // Format the date for the notification
      const formattedDate = new Date(holidayDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const title = 'Holiday Notification';
      const body = `There will be a holiday on ${formattedDate}. ${description || 'Enjoy your day off!'}`;
      
      const message = {
        notification: {
          title: title,
          body: body,
        },
        data: {
          type: 'holiday_notification',
          businessId: businessId.toString(),
          holidayDate: holidayDate,
          description: description || 'Holiday',
          timestamp: new Date().toISOString(),
        },
        tokens: validTokens,
      };
      
      // For sending to multiple tokens, we need to use sendEachForMulticast instead of sendMulticast
      // or send individual notifications if sendMulticast is not available
            
      // Prepare individual messages for each token
      const messages = validTokens.map(token => ({
        notification: {
          title: message.notification.title,
          body: message.notification.body,
        },
        data: message.data,
        token: token,
      }));
            
      // Send notifications individually
      const responses = await Promise.allSettled(
        messages.map(msg => admin.messaging().send(msg))
      );
            
      let successCount = 0;
      let failureCount = 0;
      const failedTokens = [];
            
      // Process results
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        if (response.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
          const token = validTokens[i];
          const error = response.reason;
          failedTokens.push({
            token: token,
            error: error.message || error.toString()
          });
                
          // If the error indicates an invalid token, remove it from the database
          if (error.code === 'messaging/invalid-registration-token' || 
              error.code === 'messaging/registration-token-not-registered') {
            try {
              // Find the employee with this token and remove it
              const [employeeWithToken] = await db.execute(
                'SELECT id FROM employees WHERE fcm_token = ?',
                [token]
              );
              if (employeeWithToken.length > 0) {
                await db.execute(
                  'UPDATE employees SET fcm_token = NULL WHERE id = ?',
                  [employeeWithToken[0].id]
                );
                console.log('Removed invalid FCM token from employee:', employeeWithToken[0].id);
              }
            } catch (dbError) {
              console.error('Error removing invalid token from database:', dbError);
            }
          }
        }
      }
            
      console.log(`Holiday notification sent - Success: ${successCount}, Failures: ${failureCount}`);
            
      if (failureCount > 0) {
        return { 
          success: successCount > 0, 
          successCount: successCount,
          failureCount: failureCount,
          message: `Holiday notification sent to ${successCount} employees, ${failureCount} failed`,
          failedTokens: failedTokens
        };
      }
            
      return { 
        success: true, 
        successCount: successCount,
        message: `Holiday notification sent successfully to ${successCount} employees`
      };
    } catch (error) {
      console.error('Error sending holiday notification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;