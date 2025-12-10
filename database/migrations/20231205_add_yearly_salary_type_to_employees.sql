-- Add Yearly option to salary_type ENUM in employees table
ALTER TABLE employees 
MODIFY COLUMN salary_type ENUM('Monthly', 'Daily', 'Hourly', 'Yearly') NOT NULL DEFAULT 'Monthly';