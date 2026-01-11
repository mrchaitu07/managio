const db = require('../config/db');
const CustomerPayment = require('./CustomerPayment');

class CustomerSale {
  constructor(data) {
    this.id = data.id;
    this.customer_id = data.customer_id;
    this.product_name = data.product_name;
    this.quantity = data.quantity;
    this.price = data.price;
    this.total_amount = data.total_amount;
    this.sale_date = data.sale_date;
    this.notes = data.notes;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Create a new customer sale
  static async create(saleData) {
    try {
      const { customer_id, product_name, quantity, price, total_amount, sale_date, notes } = saleData;
      
      const [result] = await db.execute(
        `INSERT INTO customer_sales 
         (customer_id, product_name, quantity, price, total_amount, sale_date, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [customer_id, product_name, quantity, price, total_amount, sale_date, notes || null]
      );

      // Return the created sale
      const [rows] = await db.execute(
        'SELECT * FROM customer_sales WHERE id = ?',
        [result.insertId]
      );

      // Update customer's balance_due after creating sale
      await CustomerPayment.updateCustomerBalanceDue(customer_id);
      
      return rows.length > 0 ? new CustomerSale(rows[0]) : null;
    } catch (error) {
      console.error('Error creating customer sale:', error);
      throw error;
    }
  }

  // Get customer sale by ID
  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM customer_sales WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? new CustomerSale(rows[0]) : null;
    } catch (error) {
      console.error('Error finding customer sale by ID:', error);
      throw error;
    }
  }

  // Get all sales for a customer
  static async findByCustomerId(customer_id) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM customer_sales 
         WHERE customer_id = ? 
         ORDER BY sale_date DESC, created_at DESC`,
        [customer_id]
      );

      return rows.map(row => new CustomerSale(row));
    } catch (error) {
      console.error('Error finding customer sales by customer ID:', error);
      throw error;
    }
  }

  // Get all sales for a business owner
  static async findByOwnerId(owner_id) {
    try {
      const [rows] = await db.execute(
        `SELECT cs.* FROM customer_sales cs
         JOIN customers c ON cs.customer_id = c.id
         JOIN businesses b ON c.business_id = b.id
         WHERE b.owner_id = ?
         ORDER BY cs.sale_date DESC, cs.created_at DESC`,
        [owner_id]
      );

      return rows.map(row => new CustomerSale(row));
    } catch (error) {
      console.error('Error finding customer sales by owner ID:', error);
      throw error;
    }
  }

  // Update customer sale
  static async update(id, updateData) {
    try {
      const { product_name, quantity, price, total_amount, sale_date, notes } = updateData;
      
      const [result] = await db.execute(
        `UPDATE customer_sales 
         SET product_name = ?, quantity = ?, price = ?, total_amount = ?, sale_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [product_name, quantity, price, total_amount, sale_date, notes || null, id]
      );
      
      // Get customer_id to update balance
      if (result.affectedRows > 0) {
        const [saleRows] = await db.execute(
          'SELECT customer_id FROM customer_sales WHERE id = ?',
          [id]
        );
        
        if (saleRows.length > 0) {
          await CustomerPayment.updateCustomerBalanceDue(saleRows[0].customer_id);
        }
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating customer sale:', error);
      throw error;
    }
  }

  // Delete customer sale
  static async delete(id) {
    try {
      // Get customer_id before deleting the sale
      const [saleRows] = await db.execute(
        'SELECT customer_id FROM customer_sales WHERE id = ?',
        [id]
      );
      
      const [result] = await db.execute(
        'DELETE FROM customer_sales WHERE id = ?',
        [id]
      );
      
      // Update customer's balance_due after deleting sale
      if (result.affectedRows > 0 && saleRows.length > 0) {
        await CustomerPayment.updateCustomerBalanceDue(saleRows[0].customer_id);
      }

      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting customer sale:', error);
      throw error;
    }
  }

  // Get all sales for a customer in a specific business
  static async findByCustomerIdAndBusinessId(customer_id, business_id) {
    try {
      const [rows] = await db.execute(
        `SELECT cs.* FROM customer_sales cs
         JOIN customers c ON cs.customer_id = c.id
         WHERE cs.customer_id = ? AND c.business_id = ?
         ORDER BY cs.sale_date DESC, cs.created_at DESC`,
        [customer_id, business_id]
      );

      return rows.map(row => new CustomerSale(row));
    } catch (error) {
      console.error('Error finding customer sales by customer ID and business ID:', error);
      throw error;
    }
  }

  // Get total sales amount for a customer
  static async getTotalByCustomerId(customer_id) {
    try {
      const [rows] = await db.execute(
        'SELECT SUM(total_amount) as total FROM customer_sales WHERE customer_id = ?',
        [customer_id]
      );

      return rows[0].total ? parseFloat(rows[0].total) : 0;
    } catch (error) {
      console.error('Error getting total sales by customer ID:', error);
      throw error;
    }
  }
}

module.exports = CustomerSale;