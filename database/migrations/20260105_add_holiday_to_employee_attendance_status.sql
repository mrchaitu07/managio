-- Migration to add holiday to the status enum in employee_attendance table
-- Since MySQL doesn't allow direct addition to enum values, we need to modify the column

-- We'll modify the column to include 'holiday' in the enum values
ALTER TABLE employee_attendance 
MODIFY COLUMN status ENUM('present', 'absent', 'late', 'half_day', 'paid_leave', 'holiday') DEFAULT 'present';