-- Add FCM token column to users table
ALTER TABLE users 
ADD COLUMN fcm_token VARCHAR(255) NULL;

-- Add FCM token column to employees table
ALTER TABLE employees 
ADD COLUMN fcm_token VARCHAR(255) NULL;

-- Add FCM token column to customers table
ALTER TABLE customers 
ADD COLUMN fcm_token VARCHAR(255) NULL;