const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get holidays for a specific month and business
router.get('/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { year, month } = req.query;

    // Check if the user is the business owner
    const [businessOwnerCheck] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );

    // If not the owner, check if the user is an employee of this business
    if (businessOwnerCheck.length === 0) {
      const [employeeCheck] = await db.execute(
        'SELECT id FROM employees WHERE owner_id = (SELECT owner_id FROM businesses WHERE id = ?) AND id = ? AND is_active = TRUE',
        [businessId, req.user.id]
      );
      
      if (employeeCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Business not found or access denied'
        });
      }
    }

    let query = 'SELECT * FROM holidays WHERE business_id = ?';
    const params = [businessId];

    if (year && month) {
      // Filter by specific year and month
      query += ' AND YEAR(holiday_date) = ? AND MONTH(holiday_date) = ?';
      params.push(year, month);
    }

    query += ' ORDER BY holiday_date';

    const [holidays] = await db.execute(query, params);

    res.json({
      success: true,
      data: holidays
    });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching holidays',
      error: error.message
    });
  }
});

// Mark a date as holiday
router.post('/', auth, async (req, res) => {
  try {
    const { businessId, holiday_date, description } = req.body;

    // Verify that the business belongs to the authenticated owner
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );

    if (businesses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Business not found or access denied'
      });
    }

    // Check if holiday already exists for this date
    const [existingHolidays] = await db.execute(
      'SELECT id FROM holidays WHERE business_id = ? AND holiday_date = ?',
      [businessId, holiday_date]
    );

    if (existingHolidays.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Holiday already exists for this date'
      });
    }

    // Insert the new holiday
    const [result] = await db.execute(
      'INSERT INTO holidays (business_id, holiday_date, description) VALUES (?, ?, ?)',
      [businessId, holiday_date, description || 'Holiday']
    );

    // Update attendance records for all employees for this date to mark as holiday
    // First, get all employees for this business
    const [employees] = await db.execute(
      'SELECT id FROM employees WHERE owner_id = (SELECT owner_id FROM businesses WHERE id = ?) AND is_active = TRUE',
      [businessId]
    );

    if (employees.length > 0) {
      // Create placeholders for the IN clause
      const employeeIds = employees.map(emp => emp.id);
      const placeholders = employeeIds.map(() => '?').join(',');
      
      // Check if attendance records exist for these employees on this date
      const [existingAttendance] = await db.execute(
        `SELECT employee_id FROM employee_attendance WHERE employee_id IN (${placeholders}) AND attendance_date = ?`,
        [...employeeIds, holiday_date]
      );

      // Update existing attendance records to mark as holiday
      if (existingAttendance.length > 0) {
        const existingEmployeeIds = existingAttendance.map(record => record.employee_id);
        const existingPlaceholders = existingEmployeeIds.map(() => '?').join(',');
        
        await db.execute(
          `UPDATE employee_attendance SET status = 'holiday', updated_at = NOW() WHERE employee_id IN (${existingPlaceholders}) AND attendance_date = ?`,
          [...existingEmployeeIds, holiday_date]
        );
      }
      
      // Create new attendance records for employees who don't have records for this date
      // First, get the owner_id for the business
      const [businessOwner] = await db.execute(
        'SELECT owner_id FROM businesses WHERE id = ?',
        [businessId]
      );
      
      if (businessOwner.length > 0) {
        const ownerId = businessOwner[0].owner_id;
        
        // Get employees who don't have attendance records for this date
        const existingEmployeeIds = existingAttendance.map(record => record.employee_id);
        const allEmployeeIds = employees.map(emp => emp.id);
        
        // Find employees without existing attendance for this date
        const employeesWithoutAttendance = employees.filter(emp => 
          !existingEmployeeIds.includes(emp.id)
        );
        
        // Create new attendance records for employees without existing records
        for (const employee of employeesWithoutAttendance) {
          await db.execute(
            'INSERT INTO employee_attendance (employee_id, owner_id, business_id, attendance_date, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [employee.id, ownerId, businessId, holiday_date, 'holiday']
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Holiday marked successfully',
      data: {
        id: result.insertId,
        business_id: businessId,
        holiday_date: holiday_date,
        description: description || 'Holiday'
      }
    });
  } catch (error) {
    console.error('Error marking holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking holiday',
      error: error.message
    });
  }
});

// Remove a holiday
router.delete('/:businessId/:holiday_date', auth, async (req, res) => {
  try {
    const { businessId, holiday_date } = req.params;

    // Verify that the business belongs to the authenticated owner
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );

    if (businesses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Business not found or access denied'
      });
    }

    // Delete the holiday
    const [result] = await db.execute(
      'DELETE FROM holidays WHERE business_id = ? AND holiday_date = ?',
      [businessId, holiday_date]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Reset attendance records for all employees for this date that were marked as holiday
    const [employees] = await db.execute(
      'SELECT id FROM employees WHERE owner_id = (SELECT owner_id FROM businesses WHERE id = ?) AND is_active = TRUE',
      [businessId]
    );

    if (employees.length > 0) {
      const employeeIds = employees.map(emp => emp.id);
      const placeholders = employeeIds.map(() => '?').join(',');
      
      // Reset attendance status from 'holiday' to 'absent' for records on this date
      await db.execute(
        `UPDATE employee_attendance SET status = 'absent', updated_at = NOW() WHERE employee_id IN (${placeholders}) AND attendance_date = ? AND status = 'holiday'`,
        [...employeeIds, holiday_date]
      );
    }

    res.json({
      success: true,
      message: 'Holiday removed successfully'
    });
  } catch (error) {
    console.error('Error removing holiday:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing holiday',
      error: error.message
    });
  }
});

module.exports = router;