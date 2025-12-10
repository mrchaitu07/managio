const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');

// Get employee attendance records
router.get('/employee-attendance/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    // For employees, they can only access their own attendance records
    // For owners, they can access attendance records of their employees
    if (req.user.role === 'employee') {
      // Employee can only access their own attendance
      if (parseInt(employeeId) !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only access your own attendance records'
        });
      }
      
      // Verify that the employee exists and is active
      const [employees] = await db.execute(
        'SELECT id, owner_id FROM employees WHERE id = ? AND is_active = TRUE',
        [employeeId]
      );
      
      if (employees.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
    } else if (req.user.role === 'owner') {
      // Owner can access attendance records of their employees
      // Verify that the employee exists and belongs to the authenticated owner
      const [employees] = await db.execute(
        'SELECT id, owner_id FROM employees WHERE id = ? AND owner_id = ?',
        [employeeId, req.user.id]
      );
      
      if (employees.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    // Get attendance records with all relevant fields including absent_reason
    const [attendanceRecords] = await db.execute(
      `SELECT id, employee_id, business_id, owner_id, session_id, attendance_date, 
              check_in_time, check_out_time, status, absent_reason, qr_scanned_at, created_at, updated_at
       FROM employee_attendance 
       WHERE employee_id = ? 
       ORDER BY attendance_date DESC 
       LIMIT 30`,
      [employeeId]
    );
    
    res.json({
      success: true,
      data: attendanceRecords,
      message: 'Attendance records fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance records',
      error: error.message
    });
  }
});

// Get attendance summary for business
router.get('/attendance-summary/:businessId', auth, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { date } = req.query;
    
    // Verify that the business belongs to the authenticated owner
    const [businesses] = await db.execute(
      'SELECT id, owner_id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, req.user.id]
    );
    
    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found'
      });
    }
    
    // Build query based on date filter
    let dateCondition = '';
    let params = [businessId];
    
    if (date) {
      dateCondition = 'AND attendance_date = ?';
      params.push(date);
    }
    
    // Get attendance summary
    const [summary] = await db.execute(
      `SELECT 
         COUNT(DISTINCT employee_id) as present_employees,
         COUNT(id) as total_attendance,
         attendance_date
       FROM employee_attendance
       WHERE business_id = ? ${dateCondition}
       GROUP BY attendance_date
       ORDER BY attendance_date DESC
       LIMIT 30`,
      params
    );
    
    // Get total employees count
    const [employeeCount] = await db.execute(
      'SELECT COUNT(id) as total FROM employees WHERE owner_id = ? AND is_active = TRUE',
      [req.user.id]
    );
    
    res.json({
      success: true,
      data: {
        summary,
        totalEmployees: employeeCount[0].total
      },
      message: 'Attendance summary fetched successfully'
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance summary',
      error: error.message
    });
  }
});

module.exports = router;