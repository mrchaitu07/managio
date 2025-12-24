const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const auth = require('../middleware/auth');
const db = require('../config/db');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  }
});

const upload = multer({ storage: storage });

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
    
    // Check if employee with this mobile number already exists across ALL businesses
    const [existingEmployees] = await db.execute(
      'SELECT id, full_name, mobile_number, owner_id FROM employees WHERE mobile_number = ? AND is_active = TRUE',
      [mobileNumber]
    );
    
    if (existingEmployees.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'An employee with this mobile number already exists in the system. Each mobile number can only be used once across all businesses.'
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
    // Get the owner ID based on the user role
    // If user is an employee, use their owner_id
    // If user is an owner, use their own ID
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    let owner_id;
    let isEmployeeAccessingOwnProfile = false;
    
    if (req.user.role === 'employee') {
      // For employees, use their assigned owner's ID
      owner_id = req.user.owner_id;
      // Check if the employee is accessing their own profile
      if (parseInt(req.params.id, 10) === req.user.id) {
        isEmployeeAccessingOwnProfile = true;
      }
    } else {
      // For owners and any other roles, use the user's own ID
      owner_id = req.user.id;
    }
    
    const { id } = req.params;
    
    console.log('Get Employee Request - Employee ID:', id, 'Owner ID:', owner_id, 'Requesting User ID:', requestingUserId, 'Requesting User Role:', requestingUserRole);

    let employee = null;
    
    if (isEmployeeAccessingOwnProfile) {
      // When an employee is accessing their own profile, check if the employee exists and belongs to their owner
      employee = await Employee.getBasicById(id, owner_id);
    } else {
      // For owners or when accessing other employees, use the existing method
      employee = await Employee.getBasicById(id, owner_id);
    }

    if (!employee) {
      console.log(`Employee with ID ${id} not found for owner ${owner_id}`);
      // Check if employee exists but belongs to different owner
      const [checkResult] = await db.execute(
        'SELECT id, owner_id FROM employees WHERE id = ?',
        [id]
      );
      
      if (checkResult.length > 0) {
        console.log(`Employee ${id} exists but belongs to owner ${checkResult[0].owner_id}, not ${owner_id}`);
      } else {
        console.log(`Employee ${id} does not exist in the system`);
      }
      
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
// Handle both regular JSON and multipart form data
router.put('/:id', auth, (req, res, next) => {
  // Check if the request is multipart
  if (req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data')) {
    // Use multer middleware for multipart requests
    upload.single('photoUrl')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(500).json({
          success: false,
          message: 'File upload error',
          error: err.message
        });
      }
      // Continue with the request handler
      handleEmployeeUpdate(req, res);
    });
  } else {
    // Handle as regular JSON request
    handleEmployeeUpdate(req, res);
  }
});

// Separate function to handle the actual update logic
const handleEmployeeUpdate = async (req, res) => {
  try {
    // Get the owner ID based on the user role
    // If user is an employee, use their owner_id
    // If user is an owner, use their own ID
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    
    // Determine the appropriate owner ID based on role
    let owner_id;
    let isEmployeeUpdatingOwnProfile = false;
    
    if (req.user.role === 'employee') {
      // For employees, use their assigned owner's ID
      owner_id = req.user.owner_id;
      // Check if the employee is trying to update their own profile
      if (parseInt(req.params.id, 10) === req.user.id) {
        isEmployeeUpdatingOwnProfile = true;
      }
    } else {
      // For owners and any other roles, use the user's own ID
      owner_id = req.user.id;
    }
    
    const { id } = req.params;
    
    // Handle both regular JSON and multipart form data
    let bodyData = req.body;
    
    // If it's a multipart request with a file, req.body fields will be strings
    // We need to parse them if they're JSON strings
    if (req.body && typeof req.body === 'object') {
      // Check if any fields are JSON strings and parse them
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string' && req.body[key].startsWith('{') && req.body[key].endsWith('}')) {
          try {
            req.body[key] = JSON.parse(req.body[key]);
          } catch (e) {
            // If it's not a JSON string, keep the original value
          }
        }
      });
    }
    
    console.log('Update Employee Request - Employee ID:', id, 'Owner ID:', owner_id, 'Requesting User ID:', requestingUserId, 'Requesting User Role:', requestingUserRole, 'User from token:', req.user);
    
    // Extract fields from request body
    const {
      fullName,
      mobileNumber,
      role,
      employeeType,
      joiningDate,
      contractEndDate,
      salaryType,
      salaryAmount,
      emergencyContactName,
      emergencyContactNumber
    } = req.body;

    // Ensure proper type conversion for database query
    const employeeId = parseInt(id, 10);
    const ownerId = owner_id; // Use the owner_id determined based on user role
    
    if (isNaN(employeeId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID provided'
      });
    }
    
    // For employees updating their own profile, we need to check differently
    let currentEmployee = null;
    
    if (isEmployeeUpdatingOwnProfile) {
      // When an employee is updating their own profile, check if the employee exists and belongs to their owner
      currentEmployee = await Employee.getBasicById(employeeId, owner_id);
    } else {
      // For owners or when updating other employees, use the existing method
      currentEmployee = await Employee.getBasicById(employeeId, owner_id);
    }
    
    if (!currentEmployee) {
      console.log(`Employee with ID ${employeeId} not found for owner ${owner_id}`);
      // Check if employee exists but belongs to different owner
      const [checkResult] = await db.execute(
        'SELECT id, owner_id FROM employees WHERE id = ?',
        [employeeId]
      );
      
      if (checkResult.length > 0) {
        console.log(`Employee ${employeeId} exists but belongs to owner ${checkResult[0].owner_id}, not ${owner_id}`);
      } else {
        console.log(`Employee ${employeeId} does not exist in the system`);
      }
      
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    } else {
      console.log(`Employee ${employeeId} found for owner ${owner_id}`);
    }
    
    // Check if mobile number is being changed and if the new number already exists
    // Convert mobileNumber to string for comparison if it's a string from multipart
    if (currentEmployee.mobile_number !== String(mobileNumber)) {
      const [existingEmployees] = await db.execute(
        'SELECT id, full_name, mobile_number FROM employees WHERE mobile_number = ? AND is_active = TRUE AND id != ?',
        [String(mobileNumber), employeeId]
      );
      
      if (existingEmployees.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'An employee with this mobile number already exists in the system. Each mobile number can only be used once across all businesses.'
        });
      }
    }

    // Convert joining date format if provided
    let formattedJoiningDate = null;
    if (joiningDate) {
      const dateString = String(joiningDate);
      
      // Handle DD MMM YYYY format (e.g., "15 Jan 2024")
      if (dateString.includes(' ')) {
        const joiningDateParts = dateString.split(' ');
        if (joiningDateParts.length === 3) {
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          formattedJoiningDate = `${joiningDateParts[2]}-${monthMap[joiningDateParts[1]]}-${joiningDateParts[0]}`;
        }
      }
      // Handle YYYY-MM-DD format (e.g., "2025-11-20")
      else if (/\d{4}-\d{2}-\d{2}/.test(dateString)) {
        formattedJoiningDate = dateString.split('T')[0]; // Extract date part if ISO format
      }
    }
    
    // Convert contract end date format if provided
    let formattedContractEndDate = null;
    if (contractEndDate) {
      const dateString = String(contractEndDate);
      
      // Handle DD MMM YYYY format (e.g., "15 Jan 2024")
      if (dateString.includes(' ')) {
        const contractDateParts = dateString.split(' ');
        if (contractDateParts.length === 3) {
          const monthMap = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
            'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
            'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          formattedContractEndDate = `${contractDateParts[2]}-${monthMap[contractDateParts[1]]}-${contractDateParts[0]}`;
        }
      }
      // Handle YYYY-MM-DD format (e.g., "2025-11-20")
      else if (/\d{4}-\d{2}-\d{2}/.test(dateString)) {
        formattedContractEndDate = dateString.split('T')[0]; // Extract date part if ISO format
      }
    }

    // Convert salary amount to number if it's provided
    let processedSalaryAmount = salaryAmount;
    if (salaryAmount !== undefined && salaryAmount !== null) {
      processedSalaryAmount = parseFloat(salaryAmount);
      if (isNaN(processedSalaryAmount)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid salary amount provided'
        });
      }
    }

    // Handle photo URL - use uploaded file path if available, otherwise use provided URL
    let photoUrl = req.body.photoUrl;
    if (req.file) {
      // If a file was uploaded, use the file path regardless of what's in the body
      photoUrl = `/uploads/${req.file.filename}`; // Store the path to the uploaded file
    } else if (req.body.photoUrl === 'null' || req.body.photoUrl === 'undefined') {
      // Handle string representations of null/undefined
      photoUrl = null;
    }

    // Only update fields that are provided, keeping existing values for others
    // Special handling for photo_url: if a file was uploaded, always use the new path
    const shouldUpdatePhotoUrl = req.file || (photoUrl !== undefined && photoUrl !== null && photoUrl !== '');
    
    const employeeData = {
      full_name: fullName !== undefined && fullName !== null && fullName !== '' ? String(fullName) : currentEmployee.full_name,
      mobile_number: mobileNumber !== undefined && mobileNumber !== null && mobileNumber !== '' ? String(mobileNumber) : currentEmployee.mobile_number,
      role: role !== undefined && role !== null && role !== '' ? String(role) : currentEmployee.role,
      photo_url: shouldUpdatePhotoUrl ? photoUrl : currentEmployee.photo_url,
      employee_type: employeeType !== undefined && employeeType !== null && employeeType !== '' ? String(employeeType) : currentEmployee.employee_type,
      joining_date: formattedJoiningDate !== null ? formattedJoiningDate : currentEmployee.joining_date,
      contract_end_date: formattedContractEndDate !== null ? formattedContractEndDate : currentEmployee.contract_end_date,
      salary_type: salaryType !== undefined && salaryType !== null && salaryType !== '' ? String(salaryType) : currentEmployee.salary_type,
      salary_amount: processedSalaryAmount !== undefined && processedSalaryAmount !== null ? processedSalaryAmount : currentEmployee.salary_amount,
      emergency_contact_name: emergencyContactName !== undefined && emergencyContactName !== null && emergencyContactName !== '' ? String(emergencyContactName) : currentEmployee.emergency_contact_name,
      emergency_contact_number: emergencyContactNumber !== undefined && emergencyContactNumber !== null && emergencyContactNumber !== '' ? String(emergencyContactNumber) : currentEmployee.emergency_contact_number
    };

    const updated = await Employee.update(employeeId, ownerId, employeeData);

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
};

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
    
    // Check if employee with this mobile number already exists across ALL businesses
    const [employees] = await db.execute(
      'SELECT id, full_name, mobile_number, owner_id FROM employees WHERE mobile_number = ? AND is_active = TRUE',
      [mobileNumber]
    );
    
    if (employees.length > 0) {
      return res.status(200).json({
        success: true,
        exists: true,
        message: 'Employee with this mobile number already exists in the system',
        employee: {
          id: employees[0].id,
          full_name: employees[0].full_name,
          mobile_number: employees[0].mobile_number,
          owner_id: employees[0].owner_id
        }
      });
    }
    
    // Mobile number doesn't exist in any business
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