const db = require('../config/db');

class Customer {
  constructor(data) {
    this.id = data.id;
    this.business_id = data.business_id;
    this.customer_name = data.customer_name;
    this.customer_mobile = data.customer_mobile;
    this.customer_email = data.customer_email;
    this.customer_address = data.customer_address;
    this.balance_due = data.balance_due || 0.00;
    this.total_spent = data.total_spent || 0.00;
    this.is_active = data.is_active !== undefined ? data.is_active : true;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new customer
  static async create(customerData) {
    try {
      const {
        business_id,
        customer_name,
        customer_mobile,
        customer_email,
        customer_address
      } = customerData;

      const [result] = await db.execute(
        `INSERT INTO customers (
          business_id, customer_name, customer_mobile, customer_email, 
          customer_address
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          business_id,
          customer_name,
          customer_mobile,
          customer_email,
          customer_address
        ]
      );

      // Return the created customer
      const [rows] = await db.execute(
        'SELECT * FROM customers WHERE id = ?',
        [result.insertId]
      );

      return rows.length > 0 ? new Customer(rows[0]) : null;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  // Get customer by ID
  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM customers WHERE id = ? AND is_active = TRUE',
        [id]
      );

      return rows.length > 0 ? new Customer(rows[0]) : null;
    } catch (error) {
      console.error('Error finding customer by ID:', error);
      throw error;
    }
  }

  // Get all customers for a business
  static async findByBusinessId(business_id) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM customers 
         WHERE business_id = ? AND is_active = TRUE 
         ORDER BY customer_name ASC`,
        [business_id]
      );

      return rows.map(row => new Customer(row));
    } catch (error) {
      console.error('Error finding customers by business ID:', error);
      throw error;
    }
  }

  // Update customer
  static async update(id, updateData) {
    try {
      const {
        customer_name,
        customer_mobile,
        customer_email,
        customer_address,
        is_active
      } = updateData;

      // Build dynamic query based on provided fields
      const fields = [];
      const values = [];

      if (customer_name !== undefined) {
        fields.push('customer_name = ?');
        values.push(customer_name);
      }
      if (customer_mobile !== undefined) {
        fields.push('customer_mobile = ?');
        values.push(customer_mobile);
      }
      if (customer_email !== undefined) {
        fields.push('customer_email = ?');
        values.push(customer_email);
      }
      if (customer_address !== undefined) {
        fields.push('customer_address = ?');
        values.push(customer_address);
      }
      if (is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(is_active);
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id); // for WHERE clause

      const query = `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`;
      await db.execute(query, values);

      // Return updated customer
      return await Customer.findById(id);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  // Delete customer (soft delete by setting is_active to false)
  static async delete(id) {
    try {
      await db.execute(
        'UPDATE customers SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  }

  // Search customers by name, mobile, or email
  static async search(business_id, searchTerm) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM customers 
         WHERE business_id = ? 
         AND is_active = TRUE 
         AND (customer_name LIKE ? OR customer_mobile LIKE ? OR customer_email LIKE ?)
         ORDER BY customer_name ASC`,
        [
          business_id,
          `%${searchTerm}%`,
          `%${searchTerm}%`,
          `%${searchTerm}%`
        ]
      );

      return rows.map(row => new Customer(row));
    } catch (error) {
      console.error('Error searching customers:', error);
      throw error;
    }
  }

  // Get customer count by business ID
  static async getCountByBusinessId(business_id) {
    try {
      const [rows] = await db.execute(
        'SELECT COUNT(*) as count FROM customers WHERE business_id = ? AND is_active = TRUE',
        [business_id]
      );
      
      return rows[0].count;
    } catch (error) {
      console.error('Error getting customer count by business ID:', error);
      throw error;
    }
  }
}

module.exports = Customer;