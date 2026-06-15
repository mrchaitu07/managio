-- Migration: Add subscription columns to users table
-- Date: 2026-06-02
-- Description: Adds subscription status, Razorpay subscription tracking, trial dates, and payment status

ALTER TABLE users ADD COLUMN subscription_status ENUM('trial','active','expired','cancelled') DEFAULT NULL;
ALTER TABLE users ADD COLUMN razorpay_subscription_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN trial_start_date TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN trial_end_date TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN subscription_start_date TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN subscription_end_date TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN last_payment_status VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN razorpay_plan_id VARCHAR(255) DEFAULT NULL;
