// Initialize Firebase Admin SDK first
require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  // Using service account key file for authentication
  const serviceAccount = require('./managio-app-firebase-adminsdk-fbsvc-ca50bcfbfc.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  console.log('Firebase Admin SDK initialized successfully with service account');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK with service account:', error);
  console.log('Falling back to application default credentials');
  
  // Fallback to application default credentials if service account fails
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    
    console.log('Firebase Admin SDK initialized successfully with application default credentials');
  } catch (fallbackError) {
    console.error('Error initializing with fallback credentials:', fallbackError);
    console.error('Firebase Admin SDK could not be initialized');
  }
}

const NotificationService = require('./services/notificationService');

async function testNotificationService() {
  try {
    console.log('Testing Notification Service...');
    
    // Test sendTestNotification method
    console.log('\n1. Testing sendTestNotification...');
    const testResult = await NotificationService.sendTestNotification(
      2, 
      'owner', 
      'Test Attendance Notification', 
      'This is a test attendance notification'
    );
    console.log('Test notification result:', testResult);
    
    // Test sendAttendanceUpdateNotification method
    console.log('\n2. Testing sendAttendanceUpdateNotification...');
    const updateResult = await NotificationService.sendAttendanceUpdateNotification(
      7, 
      'present', 
      '2026-02-08', 
      '09:00:00'
    );
    console.log('Attendance update notification result:', updateResult);
    
    // Test sendAttendanceMarkNotification method
    console.log('\n3. Testing sendAttendanceMarkNotification...');
    const markResult = await NotificationService.sendAttendanceMarkNotification(
      7, 
      'present', 
      '2026-02-08', 
      '09:00:00'
    );
    console.log('Attendance mark notification result:', markResult);
    
    // Test sendEmployeeAttendanceNotification method
    console.log('\n4. Testing sendEmployeeAttendanceNotification...');
    const employeeResult = await NotificationService.sendEmployeeAttendanceNotification(
      2, 
      'John Doe', 
      'present', 
      '2026-02-08', 
      '09:00:00'
    );
    console.log('Employee attendance notification result:', employeeResult);
    
  } catch (error) {
    console.error('Error testing notification service:', error);
  }
}

testNotificationService();