-- Migration to add absent_reason column to employee_attendance table
ALTER TABLE employee_attendance 
ADD COLUMN absent_reason TEXT AFTER status;