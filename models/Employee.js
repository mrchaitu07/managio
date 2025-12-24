const db = require('../config/db');
const Payment = require('./Payment');

class Employee {
  // Create a new employee
  static async create(employeeData) {
    const {
      owner_id,
      full_name,
      mobile_number,
      role,
      photo_url,
      employee_type,
      joining_date,
      contract_end_date,
      salary_type,
      salary_amount,
      emergency_contact_name,
      emergency_contact_number
    } = employeeData;

    const [result] = await db.execute(
      `INSERT INTO employees (
        owner_id, full_name, mobile_number, role, photo_url, employee_type, 
        joining_date, contract_end_date, salary_type, salary_amount, emergency_contact_name, emergency_contact_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        owner_id, full_name, mobile_number, role, photo_url, employee_type,
        joining_date, contract_end_date, salary_type, salary_amount, emergency_contact_name, emergency_contact_number
      ]
    );

    return result.insertId;
  }

  // Get all employees for an owner with payment information
  static async getByOwnerId(ownerId) {
    const [rows] = await db.execute(
      `SELECT *, id as employee_id FROM employees WHERE owner_id = ? ORDER BY full_name`,
      [ownerId]
    );
    
    // Optimize payment information retrieval to avoid connection exhaustion
    if (rows.length === 0) {
      return [];
    }
    
    // Get all employee IDs
    const employeeIds = rows.map(employee => employee.employee_id);
    
    // Get all payments for these employees in a single query using the optimized method
    const paymentMap = await Payment.getTotalPaidAmounts(employeeIds);
    
    // Add payment information to each employee
    const employeesWithPayments = rows.map(employee => {
      const totalPaid = paymentMap[employee.employee_id] || 0;
      return {
        ...employee,
        total_paid: totalPaid,
        remaining_amount: parseFloat(employee.salary_amount || 0) - totalPaid
      };
    });
    
    return employeesWithPayments;
  }

  // Get employee by ID with payment information
  static async getById(id, ownerId) {
    const [rows] = await db.execute(
      `SELECT *, id as employee_id FROM employees WHERE id = ? AND owner_id = ?`,
      [id, ownerId]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    const employee = rows[0];
    const totalPaid = await Payment.getTotalPaidAmount(employee.employee_id);
    
    return {
      ...employee,
      total_paid: totalPaid,
      remaining_amount: parseFloat(employee.salary_amount || 0) - totalPaid
    };
  }

  // Update employee
  static async update(id, ownerId, employeeData) {
    const {
      full_name,
      mobile_number,
      role,
      photo_url,
      employee_type,
      joining_date,
      contract_end_date,
      salary_type,
      salary_amount,
      emergency_contact_name,
      emergency_contact_number
    } = employeeData;

    // Convert undefined values to null to prevent database binding errors
    const processedData = {
      full_name: full_name !== undefined ? full_name : null,
      mobile_number: mobile_number !== undefined ? mobile_number : null,
      role: role !== undefined ? role : null,
      photo_url: photo_url !== undefined ? photo_url : null,
      employee_type: employee_type !== undefined ? employee_type : null,
      joining_date: joining_date !== undefined ? joining_date : null,
      contract_end_date: contract_end_date !== undefined ? contract_end_date : null,
      salary_type: salary_type !== undefined ? salary_type : null,
      salary_amount: salary_amount !== undefined ? salary_amount : null,
      emergency_contact_name: emergency_contact_name !== undefined ? emergency_contact_name : null,
      emergency_contact_number: emergency_contact_number !== undefined ? emergency_contact_number : null
    };

    const [result] = await db.execute(
      `UPDATE employees SET 
        full_name = ?, mobile_number = ?, role = ?, photo_url = ?, employee_type = ?,
        joining_date = ?, contract_end_date = ?, salary_type = ?, salary_amount = ?, emergency_contact_name = ?, emergency_contact_number = ?
       WHERE id = ? AND owner_id = ?`,
      [
        processedData.full_name, 
        processedData.mobile_number, 
        processedData.role, 
        processedData.photo_url, 
        processedData.employee_type,
        processedData.joining_date, 
        processedData.contract_end_date, 
        processedData.salary_type, 
        processedData.salary_amount, 
        processedData.emergency_contact_name, 
        processedData.emergency_contact_number,
        id, ownerId
      ]
    );

    return result.affectedRows > 0;
  }

  // Delete employee
  static async delete(id, ownerId) {
    const [result] = await db.execute(
      'DELETE FROM employees WHERE id = ? AND owner_id = ?',
      [id, ownerId]
    );

    return result.affectedRows > 0;
  }

  // Get employee count for an owner
  static async getCountByOwnerId(ownerId) {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as count FROM employees WHERE owner_id = ?',
      [ownerId]
    );

    return rows[0].count;
  }
}

module.exports = Employee;