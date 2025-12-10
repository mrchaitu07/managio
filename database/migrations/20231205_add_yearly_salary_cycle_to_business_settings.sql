-- Add Yearly option to salary_cycle ENUM in business_settings table
ALTER TABLE business_settings 
MODIFY COLUMN salary_cycle ENUM('weekly', 'bi_weekly', 'monthly', 'yearly') DEFAULT 'monthly';