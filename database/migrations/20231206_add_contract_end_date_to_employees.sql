-- Add contract_end_date column to employees table
ALTER TABLE employees 
ADD COLUMN contract_end_date DATE NULL AFTER joining_date;