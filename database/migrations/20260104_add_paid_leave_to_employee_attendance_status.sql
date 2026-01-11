-- Migration to add paid_leave to the status enum in employee_attendance table
-- Since MySQL doesn't allow direct addition to enum values, we need to modify the column
-- First, let's check if paid_leave is already in the enum

-- We'll modify the column to include 'paid_leave' in the enum values
ALTER TABLE employee_attendance 
MODIFY COLUMN status ENUM('present', 'absent', 'late', 'half_day', 'paid_leave') DEFAULT 'present';