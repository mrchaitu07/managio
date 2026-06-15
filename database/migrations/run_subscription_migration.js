/**
 * Run subscription migration
 * Usage: node run_subscription_migration.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'mangio_db',
      port: process.env.DB_PORT || 3306,
    });
    console.log('Connected successfully.');

    const sqlFile = path.join(__dirname, '20260602_add_subscription_to_users.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Split by semicolons and run each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        console.log(`Running: ${statement.substring(0, 80)}...`);
        await connection.execute(statement);
        console.log('  ✓ Success');
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ⚠ Column already exists, skipping.`);
        } else {
          console.error(`  ✗ Error: ${err.message}`);
          throw err;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

runMigration();
