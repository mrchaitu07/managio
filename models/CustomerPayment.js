const db = require('../config/db');

class CustomerPayment {
  constructor(data) {
    this.id = data.id;
    this.customer_id = data.customer_id;
    this.amount = data.amount;
    this.payment_method = data.payment_method;
    this.payment_date = data.payment_date;
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new customer payment
  static async create(paymentData) {
    try {
      const { customer_id, amount, payment_method, payment_date, notes } = paymentData;
      
      const [result] = await db.execute(
        `INSERT INTO customer_payments 
         (customer_id, amount, payment_method, payment_date, notes) 
         VALUES (?, ?, ?, ?, ?)`,
        [customer_id, amount, payment_method, payment_date, notes || null]
      );

      // Return the created payment
      const [rows] = await db.execute(
        'SELECT * FROM customer_payments WHERE id = ?',
        [result.insertId]
      );

      // Update customer's balance_due after creating payment
      await CustomerPayment.updateCustomerBalanceDue(customer_id);
      
      return rows.length > 0 ? new CustomerPayment(rows[0]) : null;
    } catch (error) {
      console.error('Error creating customer payment:', error);
      throw error;
    }
  }
  
  // Update customer's balance due after payment
  static async updateCustomerBalanceDue(customer_id) {
    try {
      // Get total sales for the customer
      const [salesRows] = await db.execute(
        'SELECT SUM(total_amount) as total_sales FROM customer_sales WHERE customer_id = ?',
        [customer_id]
      );
      
      // Get total payments for the customer
      const [paymentsRows] = await db.execute(
        'SELECT SUM(amount) as total_payments FROM customer_payments WHERE customer_id = ?',
        [customer_id]
      );
      
      const totalSales = salesRows[0].total_sales ? parseFloat(salesRows[0].total_sales) : 0;
      const totalPayments = paymentsRows[0].total_payments ? parseFloat(paymentsRows[0].total_payments) : 0;
      
      // Calculate balance due
      const balanceDue = totalSales - totalPayments;
      
      // Update the customer's balance_due and total_spent
      await db.execute(
        'UPDATE customers SET balance_due = ?, total_spent = ? WHERE id = ?',
        [balanceDue, totalPayments, customer_id]
      );
    } catch (error) {
      console.error('Error updating customer balance due:', error);
      throw error;
    }
  }

  // Get customer payment by ID
  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM customer_payments WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? new CustomerPayment(rows[0]) : null;
    } catch (error) {
      console.error('Error finding customer payment by ID:', error);
      throw error;
    }
  }

  // Get all payments for a customer
  static async findByCustomerId(customer_id) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM customer_payments 
         WHERE customer_id = ? 
         ORDER BY payment_date DESC, created_at DESC`,
        [customer_id]
      );

      return rows.map(row => new CustomerPayment(row));
    } catch (error) {
      console.error('Error finding customer payments by customer ID:', error);
      throw error;
    }
  }

  // Get all payments for a business owner
  static async findByOwnerId(owner_id) {
    try {
      const [rows] = await db.execute(
        `SELECT cp.* FROM customer_payments cp
         JOIN customers c ON cp.customer_id = c.id
         JOIN businesses b ON c.business_id = b.id
         WHERE b.owner_id = ?
         ORDER BY cp.payment_date DESC, cp.created_at DESC`,
        [owner_id]
      );

      return rows.map(row => new CustomerPayment(row));
    } catch (error) {
      console.error('Error finding customer payments by owner ID:', error);
      throw error;
    }
  }

  // Update customer payment
  static async update(id, updateData) {
    try {
      const { amount, payment_method, payment_date, notes } = updateData;
      
      const [result] = await db.execute(
        `UPDATE customer_payments 
         SET amount = ?, payment_method = ?, payment_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [amount, payment_method, payment_date, notes || null, id]
      );
      
      // Get customer_id to update balance
      if (result.affectedRows > 0) {
        const [paymentRows] = await db.execute(
          'SELECT customer_id FROM customer_payments WHERE id = ?',
          [id]
        );
        
        if (paymentRows.length > 0) {
          await CustomerPayment.updateCustomerBalanceDue(paymentRows[0].customer_id);
        }
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating customer payment:', error);
      throw error;
    }
  }

  // Delete customer payment
  static async delete(id) {
    try {
      // Get customer_id before deleting the payment
      const [paymentRows] = await db.execute(
        'SELECT customer_id FROM customer_payments WHERE id = ?',
        [id]
      );
      
      const [result] = await db.execute(
        'DELETE FROM customer_payments WHERE id = ?',
        [id]
      );
      
      // Update customer's balance_due after deleting payment
      if (result.affectedRows > 0 && paymentRows.length > 0) {
        await CustomerPayment.updateCustomerBalanceDue(paymentRows[0].customer_id);
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting customer payment:', error);
      throw error;
    }
  }

  // Get all payments for a customer in a specific business
  static async findByCustomerIdAndBusinessId(customer_id, business_id) {
    try {
      const [rows] = await db.execute(
        `SELECT cp.* FROM customer_payments cp
         JOIN customers c ON cp.customer_id = c.id
         WHERE cp.customer_id = ? AND c.business_id = ?
         ORDER BY cp.payment_date DESC, cp.created_at DESC`,
        [customer_id, business_id]
      );

      return rows.map(row => new CustomerPayment(row));
    } catch (error) {
      console.error('Error finding customer payments by customer ID and business ID:', error);
      throw error;
    }
  }

  // Get total payments amount for a customer
  static async getTotalByCustomerId(customer_id) {
    try {
      const [rows] = await db.execute(
        'SELECT SUM(amount) as total FROM customer_payments WHERE customer_id = ?',
        [customer_id]
      );

      return rows[0].total ? parseFloat(rows[0].total) : 0;
    } catch (error) {
      console.error('Error getting total payments by customer ID:', error);
      throw error;
    }
  }
}

module.exports = CustomerPayment;