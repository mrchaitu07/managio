const db = require('../config/db');

class Payment {
  // Create a new payment record
  static async create(paymentData) {
    const { ownerId, employeeId, paymentDate, amount, note } = paymentData;
    
    const [result] = await db.execute(
      `INSERT INTO payments (owner_id, employee_id, payment_date, amount, note) 
       VALUES (?, ?, ?, ?, ?)`,
      [ownerId, employeeId, paymentDate, amount, note]
    );
    
    return result.insertId;
  }

  // Get all payments for an employee
  static async getByEmployeeId(employeeId) {
    const [rows] = await db.execute(
      `SELECT * FROM payments 
       WHERE employee_id = ? 
       ORDER BY payment_date DESC, created_at DESC`,
      [employeeId]
    );
    
    return rows;
  }

  // Get total paid amount for an employee
  static async getTotalPaidAmount(employeeId) {
    const [rows] = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments 
       WHERE employee_id = ?`,
      [employeeId]
    );
    
    return rows[0] ? parseFloat(rows[0].total_paid) : 0;
  }

  // Get all payments for a business owner
  static async getByOwnerId(ownerId) {
    const [rows] = await db.execute(
      `SELECT p.*, e.full_name as employee_name 
       FROM payments p
       JOIN employees e ON p.employee_id = e.id
       WHERE p.owner_id = ?
       ORDER BY p.payment_date DESC, p.created_at DESC`,
      [ownerId]
    );
    
    return rows;
  }

  // Get payment by ID
  static async getById(paymentId) {
    const [rows] = await db.execute(
      `SELECT * FROM payments WHERE id = ?`,
      [paymentId]
    );
    
    return rows[0];
  }

  // Update payment record
  static async update(paymentId, paymentData) {
    const { paymentDate, amount, note } = paymentData;
    
    const [result] = await db.execute(
      `UPDATE payments 
       SET payment_date = ?, amount = ?, note = ?
       WHERE id = ?`,
      [paymentDate, amount, note, paymentId]
    );
    
    return result.affectedRows > 0;
  }

  // Delete payment record
  static async delete(paymentId) {
    const [result] = await db.execute(
      `DELETE FROM payments WHERE id = ?`,
      [paymentId]
    );
    
    return result.affectedRows > 0;
  }
}

module.exports = Payment;