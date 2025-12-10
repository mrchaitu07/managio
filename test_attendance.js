const db = require('./config/db');

// Test if the absent_reason column exists
db.execute('DESCRIBE employee_attendance')
  .then(([rows]) => {
    console.log('Table structure:');
    rows.forEach(row => {
      console.log(`${row.Field}: ${row.Type}`);
    });
    
    // Check specifically for absent_reason column
    const hasAbsentReason = rows.some(row => row.Field === 'absent_reason');
    console.log('\nHas absent_reason column:', hasAbsentReason);
    
    if (hasAbsentReason) {
      console.log('Testing insert with absent_reason...');
      // Test inserting a record with absent_reason
      return db.execute(
        'INSERT INTO employee_attendance (employee_id, business_id, owner_id, attendance_date, status, absent_reason) VALUES (?, ?, ?, ?, ?, ?)',
        [1, 1, 1, '2023-12-01', 'absent', 'Sick leave']
      );
    } else {
      console.log('absent_reason column not found!');
      return Promise.reject('Column missing');
    }
  })
  .then(([result]) => {
    console.log('Insert successful, inserted ID:', result.insertId);
    // Clean up test record
    return db.execute('DELETE FROM employee_attendance WHERE id = ?', [result.insertId]);
  })
  .then(() => {
    console.log('Test record cleaned up');
  })
  .catch(error => {
    console.error('Test failed:', error);
  })
  .finally(() => {
    process.exit(0);
  });