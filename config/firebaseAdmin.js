const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to download your service account key from Firebase Console
// and set the path to that file, or use environment variables
try {
  // Using service account key file for authentication
  const serviceAccount = require('../managio-app-firebase-adminsdk-fbsvc-ca50bcfbfc.json');
  
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

module.exports = admin;