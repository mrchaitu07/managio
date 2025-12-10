const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',  // Default to localhost if not specified
  user: process.env.DB_USER || 'root',       // Default to root if not specified
  password: process.env.DB_PASSWORD || '',   // Default to empty password if not specified
  database: process.env.DB_NAME || 'managio_db', // Default to managio_db if not specified
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
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
