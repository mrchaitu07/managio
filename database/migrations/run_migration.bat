@echo off
cd "C:\xampp\mysql\bin"
mysql -u root -p managio_db < "..\..\Backend\database\migrations\20231125_add_absent_reason_to_employee_attendance.sql"
pause