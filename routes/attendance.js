const express = require('express');
const router = express.Router();
const db = require('../config/db');
const auth = require('../middleware/auth');
const NotificationService = require('../services/notificationService');

// Mark attendance directly (for location-based attendance)
router.post('/mark-attendance-direct', auth, async (req, res) => {
  try {
    const { employeeId, businessId, ownerId } = req.body;
    
    // Validate input
    if (!employeeId || !businessId || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, Business ID, and Owner ID are required'
      });
    }
    
    // Verify that the employee exists and is active and get full name
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Verify that the employee belongs to the business
    if (employees[0].owner_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Employee does not belong to this business'
      });
    }
    
    // Verify that the business exists and is owned by the specified owner
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, ownerId]
    );
    
    if (businesses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Business not found or does not belong to the specified owner'
      });
    }
    
    // Check if attendance already marked for today (using local date - IST)
    const currentDate = new Date();
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffsetForDate = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTimeForDate = currentDate.getTime() + (currentDate.getTimezoneOffset() * 60000);
    const istTimeForDate = new Date(utcTimeForDate + istOffsetForDate);
    const todayFormatted = istTimeForDate.getFullYear() + '-' + 
                          String(istTimeForDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(istTimeForDate.getDate()).padStart(2, '0');
    
    // Check if attendance record exists for today
    const [existingAttendance] = await db.execute(
      `SELECT id FROM employee_attendance 
       WHERE employee_id = ? 
       AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?`,
      [employeeId, todayFormatted]
    );
    
    if (existingAttendance.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }
    
    // Mark attendance with check-in time (using local timezone)
    const currentTime = new Date();
    console.log('Current time before adjustment:', currentTime.toISOString());
    
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    console.log('Current time after adjustment:', istTime.toISOString());
    console.log('Time portion:', istTime.toTimeString().split(' ')[0]);
    
    const currentTimeFormatted = istTime.toISOString().slice(0, 19).replace('T', ' ');
    // Extract only the time portion for the TIME field
    const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
    
    const [result] = await db.execute(
      'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?, ?, ?)',
      [employeeId, businessId, ownerId, todayFormatted, timePortion, 'present']
    );
    
    res.json({
      success: true,
      attendanceId: result.insertId,
      message: 'Attendance marked successfully',
      data: {
        employeeName: employees[0].full_name,
        time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
      }
    });
  } catch (error) {
    console.error('Error marking direct attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
});

// Generate attendance QR code
router.post('/generate-attendance-qr', auth, async (req, res) => {
  try {
    const { ownerId, businessId } = req.body;

    // Validate input
    if (!ownerId || !businessId) {
      return res.status(400).json({
        success: false,
        message: 'Owner ID and Business ID are required'
      });
    }
    
    // Verify that the owner owns this business
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, ownerId]
    );
    
    if (businesses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to generate QR for this business'
      });
    }
    
    // Check if there's already an active session for today
    const today = new Date();
    const todayFormatted = today.toISOString().split('T')[0];
    
    const [existingSessions] = await db.execute(
      `SELECT session_id, qr_code_data, expires_at 
       FROM attendance_sessions 
       WHERE business_id = ? AND owner_id = ? AND DATE(created_at) = ? AND expires_at > NOW()
       ORDER BY created_at DESC 
       LIMIT 1`,
      [businessId, ownerId, todayFormatted]
    );
    
    if (existingSessions.length > 0) {
      // Return the existing session instead of creating a new one
      const session = existingSessions[0];
      return res.json({
        success: true,
        sessionId: session.session_id,
        qrCodeData: session.qr_code_data,
        expiresAt: session.expires_at,
        message: 'Existing QR code retrieved successfully'
      });
    }
    
    // No existing session, generate a new one
    // Generate a unique session ID
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    
    // Set expiration time (30 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    // Create QR code data (JSON stringified)
    const qrCodeData = JSON.stringify({
      sessionId,
      businessId,
      ownerId,
      expiresAt: expiresAt.toISOString()
    });
    
    // Store session in database
    await db.execute(
      'INSERT INTO attendance_sessions (business_id, owner_id, session_id, qr_code_data, expires_at) VALUES (?, ?, ?, ?, ?)',
      [businessId, ownerId, sessionId, qrCodeData, expiresAt]
    );
    
    res.json({
      success: true,
      sessionId,
      qrCodeData,
      expiresAt: expiresAt.toISOString(),
      message: 'QR code generated successfully'
    });
  } catch (error) {
    console.error('Error generating attendance QR:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating attendance QR code',
      error: error.message
    });
  }
});

// Mark attendance using QR code
router.post('/mark-attendance', auth, async (req, res) => {
  try {
    const { employeeId, sessionId } = req.body;
    
    // Validate input
    if (!employeeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and Session ID are required'
      });
    }
    
    // Verify that the employee exists and is active and get full name
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Get the attendance session
    const [sessions] = await db.execute(
      'SELECT id, business_id, owner_id, expires_at FROM attendance_sessions WHERE session_id = ? AND expires_at > NOW()',
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
    
    const session = sessions[0];
    
    // Verify that the employee belongs to the business
    if (employees[0].owner_id !== session.owner_id) {
      return res.status(403).json({
        success: false,
        message: 'Employee does not belong to this business'
      });
    }
    
    // Check if attendance already marked for today (using local date - IST)
    const currentDate = new Date();
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffsetForDate = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTimeForDate = currentDate.getTime() + (currentDate.getTimezoneOffset() * 60000);
    const istTimeForDate = new Date(utcTimeForDate + istOffsetForDate);
    const todayFormatted = istTimeForDate.getFullYear() + '-' + 
                          String(istTimeForDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(istTimeForDate.getDate()).padStart(2, '0');
    
    // Check if attendance record exists for today
    const query = `SELECT id, check_in_time FROM employee_attendance 
       WHERE employee_id = ? 
       AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?
       AND session_id = ?`;
    const params = [employeeId, todayFormatted, sessionId];
    
    console.log('Executing query:', query, 'with params:', params);
    
    const [existingAttendance] = await db.execute(query, params);
    
    console.log('Found existing attendance records:', existingAttendance.length);
    if (existingAttendance.length > 0) {
      console.log('First attendance record:', existingAttendance[0]);
    } else {
      // Let's also check if there are any records for today regardless of session ID
      const [allTodayRecords] = await db.execute(
        `SELECT * FROM employee_attendance 
         WHERE employee_id = ? 
         AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?`,
        [employeeId, todayFormatted]
      );
      
      console.log('All records for employee today (regardless of session):', allTodayRecords);
      
      if (allTodayRecords.length > 0) {
        console.log('Found record with different session ID:', allTodayRecords[0].session_id);
      }
    }
    
    if (existingAttendance.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for today'
      });
    }
    
    // Mark attendance with check-in time (using local timezone)
    // Use a more reliable method for timezone conversion
    const currentTime = new Date();
    console.log('Current time before adjustment:', currentTime.toISOString());
    
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    console.log('Current time after adjustment:', istTime.toISOString());
    console.log('Time portion:', istTime.toTimeString().split(' ')[0]);
    
    const currentTimeFormatted = istTime.toISOString().slice(0, 19).replace('T', ' ');
    // Extract only the time portion for the TIME field
    const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
    
    const [result] = await db.execute(
      'INSERT INTO employee_attendance (employee_id, business_id, owner_id, session_id, attendance_date, check_in_time, status, qr_scanned_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, session.business_id, session.owner_id, sessionId, todayFormatted, timePortion, 'present', currentTimeFormatted]
    );
    
    res.json({
      success: true,
      attendanceId: result.insertId,
      message: 'Attendance marked successfully',
      data: {
        employeeName: employees[0].full_name,
        time: currentTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
      }
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
});

// Mark check-out using QR code
router.post('/mark-checkout', auth, async (req, res) => {
  try {
    const { employeeId, sessionId } = req.body;
    
    // Validate input
    if (!employeeId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and Session ID are required'
      });
    }
    
    // Verify that the employee exists and is active and get full name
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Get the attendance session
    const [sessions] = await db.execute(
      'SELECT id, business_id, owner_id, expires_at FROM attendance_sessions WHERE session_id = ? AND expires_at > NOW()',
      [sessionId]
    );
    
    if (sessions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired session'
      });
    }
    
    const session = sessions[0];
    
    // Verify that the employee belongs to the business
    if (employees[0].owner_id !== session.owner_id) {
      return res.status(403).json({
        success: false,
        message: 'Employee does not belong to this business'
      });
    }
    
    // Check if attendance already marked for today (using local date)
    const today = new Date();
    // Adjust for local timezone (IST is UTC+5:30)
    today.setHours(today.getHours() + 5);
    today.setMinutes(today.getMinutes() + 30);
    const todayFormatted = today.toISOString().split('T')[0];
    
    console.log('Check-out request - Employee ID:', employeeId, 'Session ID:', sessionId, 'Today (IST):', todayFormatted);
    
    // First, let's see what attendance records exist for this employee
    const [allAttendance] = await db.execute(
      'SELECT * FROM employee_attendance WHERE employee_id = ?',
      [employeeId]
    );
    
    console.log('All attendance records for employee:', allAttendance);
    
    // Check if attendance record exists for today
    const [existingAttendance] = await db.execute(
      `SELECT id, check_in_time FROM employee_attendance 
       WHERE employee_id = ? 
       AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?
       AND session_id = ?`,
      [employeeId, todayFormatted, sessionId]
    );
    
    console.log('Found existing attendance records:', existingAttendance.length);
    if (existingAttendance.length > 0) {
      console.log('First attendance record:', existingAttendance[0]);
    }
    
    if (existingAttendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today. Please check-in first.'
      });
    }
    
    // Check if already checked out
    if (existingAttendance[0].check_out_time) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out for today'
      });
    }
    
    // Mark check-out time (using local timezone)
    // Use a more reliable method for timezone conversion
    const currentTime = new Date();
    console.log('Current time before adjustment (checkout):', currentTime.toISOString());
    
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    console.log('Current time after adjustment (checkout):', istTime.toISOString());
    console.log('Time portion (checkout):', istTime.toTimeString().split(' ')[0]);
    
    const currentTimeFormatted = istTime.toISOString().slice(0, 19).replace('T', ' ');
    // Extract only the time portion for the TIME field
    const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
    
    // Update the existing attendance record with check-out time
    const [result] = await db.execute(
      'UPDATE employee_attendance SET check_out_time = ?, updated_at = ? WHERE id = ?',
      [timePortion, currentTimeFormatted, existingAttendance[0].id]
    );
    
    res.json({
      success: true,
      message: 'Check-out marked successfully',
      data: {
        employeeName: employees[0].full_name,
        time: currentTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
      }
    });
  } catch (error) {
    console.error('Error marking check-out:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking check-out',
      error: error.message
    });
  }
});

// Mark check-out directly (for location-based attendance)
router.post('/mark-checkout-direct', auth, async (req, res) => {
  try {
    const { employeeId, businessId, ownerId } = req.body;
    
    // Validate input
    if (!employeeId || !businessId || !ownerId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, Business ID, and Owner ID are required'
      });
    }
    
    // Verify that the employee exists and is active and get full name
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Verify that the employee belongs to the business
    if (employees[0].owner_id !== ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Employee does not belong to this business'
      });
    }
    
    // Verify that the business exists and is owned by the specified owner
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE id = ? AND owner_id = ?',
      [businessId, ownerId]
    );
    
    if (businesses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Business not found or does not belong to the specified owner'
      });
    }
    
    // Check if attendance already marked for today (using local date - IST)
    const currentDate = new Date();
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffsetForDate = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTimeForDate = currentDate.getTime() + (currentDate.getTimezoneOffset() * 60000);
    const istTimeForDate = new Date(utcTimeForDate + istOffsetForDate);
    const todayFormatted = istTimeForDate.getFullYear() + '-' + 
                          String(istTimeForDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(istTimeForDate.getDate()).padStart(2, '0');
    
    console.log('Direct check-out request - Employee ID:', employeeId, 'Business ID:', businessId, 'Owner ID:', ownerId, 'Today (IST):', todayFormatted);
    
    // First, let's see what attendance records exist for this employee
    const [allAttendance] = await db.execute(
      'SELECT * FROM employee_attendance WHERE employee_id = ?',
      [employeeId]
    );
    
    console.log('All attendance records for employee:', allAttendance);
    
    // Check if attendance record exists for today
    const [existingAttendance] = await db.execute(
      `SELECT id, check_in_time FROM employee_attendance 
       WHERE employee_id = ? 
       AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?`,
      [employeeId, todayFormatted]
    );
    
    console.log('Found existing attendance records:', existingAttendance.length);
    if (existingAttendance.length > 0) {
      console.log('First attendance record:', existingAttendance[0]);
    }
    
    if (existingAttendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No check-in record found for today. Please check-in first.'
      });
    }
    
    // Check if already checked out
    if (existingAttendance[0].check_out_time) {
      return res.status(400).json({
        success: false,
        message: 'Already checked out for today'
      });
    }
    
    // Mark check-out time (using local timezone)
    const currentTime = new Date();
    console.log('Current time before adjustment (checkout):', currentTime.toISOString());
    
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    console.log('Current time after adjustment (checkout):', istTime.toISOString());
    console.log('Time portion (checkout):', istTime.toTimeString().split(' ')[0]);
    
    const currentTimeFormatted = istTime.toISOString().slice(0, 19).replace('T', ' ');
    // Extract only the time portion for the TIME field
    const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
    
    // Update the existing attendance record with check-out time
    const [result] = await db.execute(
      'UPDATE employee_attendance SET check_out_time = ?, updated_at = ? WHERE id = ?',
      [timePortion, currentTimeFormatted, existingAttendance[0].id]
    );
    
    res.json({
      success: true,
      message: 'Check-out marked successfully',
      data: {
        employeeName: employees[0].full_name,
        time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
      }
    });
  } catch (error) {
    console.error('Error marking direct check-out:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking check-out',
      error: error.message
    });
  }
});

// Mark attendance manually (for manual attendance method)
router.post('/mark-attendance-manual', auth, async (req, res) => {
  try {
    const { employeeId, status, absentReason } = req.body;
    
    // Validate input
    if (!employeeId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and status are required'
      });
    }
    
    // Validate status
    if (status !== 'present' && status !== 'absent' && status !== 'late' && status !== 'half_day' && status !== 'paid_leave') {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "present", "absent", "late", "half_day", or "paid_leave"'
      });
    }
    
    // Verify that the employee exists and is active and get full name and owner_id
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Verify that the employee belongs to the authenticated owner
    if (employees[0].owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark attendance for this employee'
      });
    }
    
    // Get business_id from businesses table using owner_id
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE owner_id = ? LIMIT 1',
      [employees[0].owner_id]
    );
    
    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this employee'
      });
    }
    
    const businessId = businesses[0].id;
    
    // Check if attendance already marked for today (using local date - IST)
    const currentDate = new Date();
    // Adjust for local timezone (IST is UTC+5:30) using getTimezoneOffset
    const istOffsetForDate = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const utcTimeForDate = currentDate.getTime() + (currentDate.getTimezoneOffset() * 60000);
    const istTimeForDate = new Date(utcTimeForDate + istOffsetForDate);
    const todayFormatted = istTimeForDate.getFullYear() + '-' + 
                          String(istTimeForDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(istTimeForDate.getDate()).padStart(2, '0');
    
    // Check if attendance record exists for today
    const [existingAttendance] = await db.execute(
      `SELECT id FROM employee_attendance 
       WHERE employee_id = ? 
       AND DATE(CONVERT_TZ(attendance_date, '+00:00', '+05:30')) = ?`,
      [employeeId, todayFormatted]
    );
    
    // Mark attendance based on status
    if (status === 'present') {
      // For present, mark with current time
      const currentTime = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
      const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
      const istTime = new Date(utcTime + istOffset);
      
      const currentTimeFormatted = istTime.toISOString().slice(0, 19).replace('T', ' ');
      const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
      
      if (existingAttendance.length > 0) {
        // Update existing record
        const [result] = await db.execute(
          'UPDATE employee_attendance SET status = ?, check_in_time = ?, absent_reason = NULL, updated_at = ? WHERE id = ?',
          [status, timePortion, currentTimeFormatted, existingAttendance[0].id]
        );
        
        // Send notification to employee about attendance
        if (status === 'present') {
          try {
            await NotificationService.sendGeneralNotification(
              employeeId,
              'employee',
              'Attendance Updated',
              `Your attendance has been updated to ${status} at ${timePortion} today.`,
              {
                type: 'attendance_update',
                status: status,
                date: todayFormatted,
                time: timePortion
              }
            );
          } catch (notificationError) {
            console.error('Error sending attendance notification:', notificationError);
            // Continue with response even if notification fails
          }
        }
        
        res.json({
          success: true,
          attendanceId: existingAttendance[0].id,
          message: `Attendance updated to ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
          }
        });
      } else {
        // Insert new record
        // Send notification to employee about attendance
        if (status === 'present') {
          try {
            await NotificationService.sendGeneralNotification(
              employeeId,
              'employee',
              'Attendance Marked',
              `Your attendance has been marked as ${status} at ${timePortion} today.`,
              {
                type: 'attendance_update',
                status: status,
                date: todayFormatted,
                time: timePortion
              }
            );
          } catch (notificationError) {
            console.error('Error sending attendance notification:', notificationError);
            // Continue with response even if notification fails
          }
        }

        const [result] = await db.execute(
          'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?, ?, ?)',
          [employeeId, businessId, employees[0].owner_id, todayFormatted, timePortion, status]
        );
        
        res.json({
          success: true,
          attendanceId: result.insertId,
          message: `Attendance marked as ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
          }
        });
      }
    } else {
      // For absent, late, half_day, paid_leave - mark with status and reason
      // Ensure absentReason is null if undefined
      const safeAbsentReason = absentReason || null;
      
      // For present status, we use check_in_time, for others we use status column
      let query, params;
      
      if (status === 'absent' || status === 'paid_leave') {
        // For absent and paid leave, use absent_reason column
        query = 'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, status, absent_reason) VALUES (?, ?, ?, ?, ?, ?)';
        params = [employeeId, businessId, employees[0].owner_id, todayFormatted, status, safeAbsentReason];
      } else {
        // For late and half_day, use absent_reason column as well
        query = 'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, status, absent_reason) VALUES (?, ?, ?, ?, ?, ?)';
        params = [employeeId, businessId, employees[0].owner_id, todayFormatted, status, safeAbsentReason];
      }
      
      if (existingAttendance.length > 0) {
        // Update existing record
        const [result] = await db.execute(
          'UPDATE employee_attendance SET status = ?, absent_reason = ?, updated_at = NOW() WHERE id = ?',
          [status, safeAbsentReason, existingAttendance[0].id]
        );
        
        res.json({
          success: true,
          attendanceId: existingAttendance[0].id,
          message: `Attendance updated to ${status} successfully`,
          data: {
            employeeName: employees[0].full_name
          }
        });
      } else {
        // Insert new record
        const [result] = await db.execute(query, params);
        
        res.json({
          success: true,
          attendanceId: result.insertId,
          message: `Attendance marked as ${status} successfully`,
          data: {
            employeeName: employees[0].full_name
          }
        });
      }
    }
  } catch (error) {
    console.error('Error marking manual attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking manual attendance',
      error: error.message
    });
  }
});

// Mark attendance for a specific date
router.post('/mark-for-date', auth, async (req, res) => {
  try {
    const { employeeId, date, status, absentReason } = req.body;
    
    // Validate input
    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID, date, and status are required'
      });
    }
    
    // Validate status
    if (status !== 'present' && status !== 'absent' && status !== 'late' && status !== 'half_day' && status !== 'paid_leave') {
      return res.status(400).json({
        success: false,
        message: 'Status must be one of: "present", "absent", "late", "half_day", or "paid_leave"'
      });
    }
    
    // Validate date format
    const attendanceDate = new Date(date);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    // Format date for database
    const formattedDate = attendanceDate.toISOString().split('T')[0];
    
    // Verify that the employee exists and is active and get owner_id
    const [employees] = await db.execute(
      'SELECT id, owner_id, full_name FROM employees WHERE id = ? AND is_active = TRUE',
      [employeeId]
    );
    
    if (employees.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found or inactive'
      });
    }
    
    // Verify that the employee belongs to the authenticated owner
    if (employees[0].owner_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark attendance for this employee'
      });
    }
    
    // Get business_id from businesses table using owner_id
    const [businesses] = await db.execute(
      'SELECT id FROM businesses WHERE owner_id = ? LIMIT 1',
      [employees[0].owner_id]
    );
    
    if (businesses.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Business not found for this employee'
      });
    }
    
    const businessId = businesses[0].id;
    
    // Check if the date is a holiday for the business
    const [holidays] = await db.execute(
      'SELECT id FROM holidays WHERE business_id = ? AND holiday_date = ?',
      [businessId, formattedDate]
    );
    
    if (holidays.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark attendance on a holiday date'
      });
    }
    
    // Check if attendance record already exists for this date
    const [existingAttendance] = await db.execute(
      `SELECT id FROM employee_attendance 
       WHERE employee_id = ? 
       AND attendance_date = ?`,
      [employeeId, formattedDate]
    );
    
    // Mark attendance based on status
    if (status === 'present') {
      // For present, mark with current time
      const currentTime = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
      const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000);
      const istTime = new Date(utcTime + istOffset);
      
      const timePortion = istTime.toTimeString().split(' ')[0]; // Gets HH:MM:SS format
      
      if (existingAttendance.length > 0) {
        // Update existing record
        const [result] = await db.execute(
          'UPDATE employee_attendance SET status = ?, check_in_time = ?, absent_reason = NULL, updated_at = ? WHERE id = ?',
          [status, timePortion, istTime.toISOString().slice(0, 19).replace('T', ' '), existingAttendance[0].id]
        );
        
        res.json({
          success: true,
          attendanceId: existingAttendance[0].id,
          message: `Attendance updated to ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            date: formattedDate,
            time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
          }
        });
      } else {
        // Insert new record
        const [result] = await db.execute(
          'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?, ?, ?)',
          [employeeId, businessId, employees[0].owner_id, formattedDate, timePortion, status]
        );
        
        res.json({
          success: true,
          attendanceId: result.insertId,
          message: `Attendance marked as ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            date: formattedDate,
            time: istTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })
          }
        });
      }
    } else {
      // For absent, late, half_day, paid_leave - mark with status and reason
      // Ensure absentReason is null if undefined
      const safeAbsentReason = absentReason || null;
      
      // For present status, we use check_in_time, for others we use status column
      let query, params;
      
      if (status === 'absent' || status === 'paid_leave') {
        // For absent and paid leave, use absent_reason column
        query = 'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, status, absent_reason) VALUES (?, ?, ?, ?, ?, ?)';
        params = [employeeId, businessId, employees[0].owner_id, formattedDate, status, safeAbsentReason];
      } else {
        // For late and half_day, use absent_reason column as well
        query = 'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, status, absent_reason) VALUES (?, ?, ?, ?, ?, ?)';
        params = [employeeId, businessId, employees[0].owner_id, formattedDate, status, safeAbsentReason];
      }
      
      if (existingAttendance.length > 0) {
        // Update existing record
        const [result] = await db.execute(
          'UPDATE employee_attendance SET status = ?, absent_reason = ?, updated_at = NOW() WHERE id = ?',
          [status, safeAbsentReason, existingAttendance[0].id]
        );
        
        res.json({
          success: true,
          attendanceId: existingAttendance[0].id,
          message: `Attendance updated to ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            date: formattedDate
          }
        });
      } else {
        // Insert new record
        const [result] = await db.execute(query, params);
        
        res.json({
          success: true,
          attendanceId: result.insertId,
          message: `Attendance marked as ${status} successfully`,
          data: {
            employeeName: employees[0].full_name,
            date: formattedDate
          }
        });
      }
    }
  } catch (error) {
    console.error('Error marking attendance for date:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance for date',
      error: error.message
    });
  }
});

module.exports = router;