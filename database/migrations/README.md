# Database Migration Instructions

## Adding absent_reason column to employee_attendance table

To apply the migration that adds the `absent_reason` column to the `employee_attendance` table, follow these steps:

1. Make sure XAMPP is running (Apache and MySQL services should be started)

2. Open phpMyAdmin or MySQL command line client

3. Execute the following SQL command:

```sql
USE managio_db;
ALTER TABLE employee_attendance ADD COLUMN absent_reason TEXT AFTER status;
```

Alternatively, you can run the migration script directly:

1. Open Command Prompt as Administrator
2. Navigate to the XAMPP MySQL bin directory:
   ```
   cd C:\xampp\mysql\bin
   ```
3. Run the migration script:
   ```
   mysql -u root -p managio_db < "C:\xampp\htdocs\Managio\Backend\database\migrations\20231125_add_absent_reason_to_employee_attendance.sql"
   ```

Note: If you have set a password for MySQL root user, you'll be prompted to enter it.

After running the migration, the `employee_attendance` table will have the new `absent_reason` column to store the reason for absence when marking an employee as absent in manual attendance mode.