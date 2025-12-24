const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const db = require('../config/db');

// Add new employee
router.post('/add', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    
    const {
      fullName,
      mobileNumber,
      role,
      photoUrl,
      employeeType,
      joiningDate,
      contractEndDate,
      salaryType,
      salaryAmount,
      emergencyContactName,
      emergencyContactNumber
    } = req.body;

    // Validation
    if (!fullName || !mobileNumber || !role || !joiningDate || !salaryAmount) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Convert joining date format (DD MMM YYYY to YYYY-MM-DD)
    const joiningDateParts = joiningDate.split(' ');
    const monthMap = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    const formattedJoiningDate = `${joiningDateParts[2]}-${monthMap[joiningDateParts[1]]}-${joiningDateParts[0]}`;
    
    // Convert contract end date format if provided
    let formattedContractEndDate = null;
    if (contractEndDate) {
      const contractDateParts = contractEndDate.split(' ');
      formattedContractEndDate = `${contractDateParts[2]}-${monthMap[contractDateParts[1]]}-${contractDateParts[0]}`;
    }

    const employeeData = {
      owner_id,
      full_name: fullName,
      mobile_number: mobileNumber,
      role,
      photo_url: photoUrl || null,
      employee_type: employeeType || 'Full-Time',
      joining_date: formattedJoiningDate,
      contract_end_date: formattedContractEndDate,
      salary_type: salaryType || 'Monthly',
      salary_amount: parseFloat(salaryAmount),
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_number: emergencyContactNumber || null
    };

    const employeeId = await Employee.create(employeeData);

    res.status(201).json({
      success: true,
      message: 'Employee added successfully',
      data: {
        employeeId
      }
    });

  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add employee',
      error: error.message
    });
  }
});

// Get all employees
router.get('/list', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const employees = await Employee.getByOwnerId(owner_id);

    res.status(200).json({
      success: true,
      data: employees
    });

  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employees',
      error: error.message
    });
  }
});

// Get employee by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const { id } = req.params;

    const employee = await Employee.getById(id, owner_id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      data: employee
    });

  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee',
      error: error.message
    });
  }
});

// Update employee
router.put('/:id', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const { id } = req.params;

    const {
      fullName,
      mobileNumber,
      role,
      photoUrl,
      employeeType,
      joiningDate,
      contractEndDate,
      salaryType,
      salaryAmount,
      emergencyContactName,
      emergencyContactNumber
    } = req.body;

    // Convert joining date format (DD MMM YYYY to YYYY-MM-DD) if provided
    let formattedJoiningDate = null;
    if (joiningDate) {
      const joiningDateParts = joiningDate.split(' ');
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      formattedJoiningDate = `${joiningDateParts[2]}-${monthMap[joiningDateParts[1]]}-${joiningDateParts[0]}`;
    }
    
    // Convert contract end date format if provided
    let formattedContractEndDate = null;
    if (contractEndDate) {
      const contractDateParts = contractEndDate.split(' ');
      const monthMap = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      formattedContractEndDate = `${contractDateParts[2]}-${monthMap[contractDateParts[1]]}-${contractDateParts[0]}`;
    }

    const employeeData = {
      full_name: fullName,
      mobile_number: mobileNumber,
      role,
      photo_url: photoUrl,
      employee_type: employeeType,
      joining_date: formattedJoiningDate,
      contract_end_date: formattedContractEndDate,
      salary_type: salaryType,
      salary_amount: salaryAmount,
      emergency_contact_name: emergencyContactName,
      emergency_contact_number: emergencyContactNumber
    };

    const updated = await Employee.update(id, owner_id, employeeData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee updated successfully'
    });

  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employee',
      error: error.message
    });
  }
});

// Delete employee
router.delete('/:id', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const { id } = req.params;

    const deleted = await Employee.delete(id, owner_id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully'
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete employee',
      error: error.message
    });
  }
});

// Get employee count
router.get('/stats/count', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const count = await Employee.getCountByOwnerId(owner_id);

    res.status(200).json({
      success: true,
      data: { count }
    });

  } catch (error) {
    console.error('Get employee count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get employee count',
      error: error.message
    });
  }
});

// Check if employee with mobile number already exists
router.post('/check-mobile', auth, async (req, res) => {
  try {
    const owner_id = req.user.id;
    const { mobileNumber } = req.body;
    
    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }
    
    // Check if employee with this mobile number already exists for this owner
    const [employees] = await db.execute(
      'SELECT id, full_name, mobile_number FROM employees WHERE mobile_number = ? AND owner_id = ? AND is_active = TRUE',
      [mobileNumber, owner_id]
    );
    
    if (employees.length > 0) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: 'Employee with this mobile number already exists',
        employee: {
          id: employees[0].id,
          full_name: employees[0].full_name,
          mobile_number: employees[0].mobile_number
        }
      });
    }
    
    // Mobile number doesn't exist for this owner
    return res.status(200).json({
      success: true,
      exists: false,
      message: 'Employee with this mobile number does not exist'
    });
    
  } catch (error) {
    console.error('Check employee mobile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check employee mobile number',
      error: error.message
    });
  }
});

module.exports = router;