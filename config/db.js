const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'managio_db',
  waitForConnections: true,
  connectionLimit: 5, // Reduced from 10 to 5 to match MySQL user limit
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
});

// Test the connection
pool.getConnection()
  .then(connection => {
    console.log('Successfully connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to MySQL:', err);
  });

module.exports = pool;