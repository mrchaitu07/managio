const db = require('../config/db');

class BusinessOwner {
  // Create a new business owner
  static async create(ownerData) {
    const {
      mobileNumber,
      fullName,
      businessName,
      businessType,
      businessCategory,
      address,
      city,
      state,
      pincode,
      businessRole,
      gender,
      dateOfBirth,
      attendanceMethod,
      startTime,
      endTime,
      weeklyOff,
      salaryCycle,
      location
    } = ownerData;

    // Start transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Create user record
      const [userResult] = await connection.execute(
        'INSERT INTO users (mobile_number, role) VALUES (?, ?)',
        [mobileNumber, 'owner']
      );

      const userId = userResult.insertId;

      // Create owner profile
      const [profileResult] = await connection.execute(
        `INSERT INTO owner_profiles (
          user_id, full_name, business_role, gender, date_of_birth
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          userId, 
          fullName, 
          businessRole || null, 
          gender || null, 
          dateOfBirth || null
        ]
      );

      // Create business
      const [businessResult] = await connection.execute(
        `INSERT INTO businesses (
          owner_id, business_name, business_type, business_category, 
          address, city, state, pincode, latitude, longitude
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          businessName,
          businessType || null,
          businessCategory || null,
          address || null,
          city || null,
          state || null,
          pincode || null,
          location ? location.latitude : null,
          location ? location.longitude : null
        ]
      );

      const businessId = businessResult.insertId;

      // Create business settings
      const [settingsResult] = await connection.execute(
        `INSERT INTO business_settings (
          business_id, attendance_method, work_start_time, work_end_time, 
          weekly_off_days, salary_cycle
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          businessId,
          attendanceMethod || 'qr_scan',
          startTime || '09:00:00',
          endTime || '17:00:00',
          weeklyOff || null,
          salaryCycle || 'monthly'
        ]
      );

      await connection.commit();

      // Return the complete owner object
      return {
        id: userId,
        mobile_number: mobileNumber,
        role: 'owner',
        profile: {
          id: profileResult.insertId,
          user_id: userId,
          full_name: fullName,
          business_role: businessRole || null,
          gender: gender || null,
          date_of_birth: dateOfBirth || null
        },
        business: {
          id: businessId,
          owner_id: userId,
          business_name: businessName,
          business_type: businessType || null,
          business_category: businessCategory || null,
          address: address || null,
          city: city || null,
          state: state || null,
          pincode: pincode || null,
          latitude: location ? location.latitude : null,
          longitude: location ? location.longitude : null
        }
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error creating business owner:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get business owner by ID with profile and business information
  static async getById(id) {
    try {
      // Get user, profile, business, and settings information
      const [rows] = await db.execute(`
        SELECT 
          u.id,
          u.mobile_number,
          u.role,
          op.full_name,
          op.business_role,
          op.gender,
          op.date_of_birth,
          b.business_name,
          b.business_type,
          b.business_category,
          b.address,
          b.city,
          b.state,
          b.pincode,
          b.latitude,
          b.longitude,
          bs.attendance_method,
          bs.work_start_time,
          bs.work_end_time,
          bs.weekly_off_days,
          bs.salary_cycle
        FROM users u
        LEFT JOIN owner_profiles op ON u.id = op.user_id
        LEFT JOIN businesses b ON u.id = b.owner_id
        LEFT JOIN business_settings bs ON b.id = bs.business_id
        WHERE u.id = ? AND u.role = 'owner'
      `, [id]);

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      
      // Get business ID separately since it's not in the joined query
      let businessId = null;
      if (row.business_name) { // Only get business ID if business exists
        const [businessRows] = await db.execute(
          'SELECT id FROM businesses WHERE owner_id = ?',
          [id]
        );
        if (businessRows.length > 0) {
          businessId = businessRows[0].id;
        }
      }
      
      return {
        id: row.id,
        mobile_number: row.mobile_number,
        role: row.role,
        profile: {
          full_name: row.full_name,
          business_role: row.business_role,
          gender: row.gender,
          date_of_birth: row.date_of_birth
        },
        business: row.business_name ? {
          id: businessId, // Include business ID
          business_name: row.business_name,
          business_type: row.business_type,
          business_category: row.business_category,
          address: row.address,
          city: row.city,
          state: row.state,
          pincode: row.pincode,
          latitude: row.latitude,
          longitude: row.longitude,
          attendance_method: row.attendance_method,
          work_start_time: row.work_start_time,
          work_end_time: row.work_end_time,
          weekly_off_days: row.weekly_off_days,
          salary_cycle: row.salary_cycle
        } : null
      };
    } catch (error) {
      console.error('Error getting business owner by ID:', error);
      throw error;
    }
  }

  // Update business owner
  static async update(id, updateData) {
    const { profile, business } = updateData;

    // Start transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Update profile if provided
      if (profile) {
        const profileFields = [];
        const profileValues = [];
        
        if (profile.full_name !== undefined) {
          profileFields.push('full_name = ?');
          profileValues.push(profile.full_name);
        }
        if (profile.business_role !== undefined) {
          profileFields.push('business_role = ?');
          profileValues.push(profile.business_role);
        }
        if (profile.gender !== undefined) {
          profileFields.push('gender = ?');
          profileValues.push(profile.gender);
        }
        if (profile.date_of_birth !== undefined) {
          profileFields.push('date_of_birth = ?');
          profileValues.push(profile.date_of_birth);
        }
        
        if (profileFields.length > 0) {
          profileValues.push(id); // for WHERE clause
          await connection.execute(
            `UPDATE owner_profiles SET ${profileFields.join(', ')} WHERE user_id = ?`,
            profileValues
          );
        }
      }

      // Update business and settings if provided
      if (business) {
        // Get business ID first
        const [businessRows] = await connection.execute(
          'SELECT id FROM businesses WHERE owner_id = ?',
          [id]
        );
        
        if (businessRows.length > 0) {
          const businessId = businessRows[0].id;
          
          // Update business fields
          const businessFields = [];
          const businessValues = [];
          
          if (business.name !== undefined) {
            businessFields.push('business_name = ?');
            businessValues.push(business.name);
          }
          if (business.type !== undefined) {
            businessFields.push('business_type = ?');
            businessValues.push(business.type);
          }
          if (business.category !== undefined) {
            businessFields.push('business_category = ?');
            businessValues.push(business.category);
          }
          if (business.address !== undefined) {
            businessFields.push('address = ?');
            businessValues.push(business.address);
          }
          if (business.city !== undefined) {
            businessFields.push('city = ?');
            businessValues.push(business.city);
          }
          if (business.state !== undefined) {
            businessFields.push('state = ?');
            businessValues.push(business.state);
          }
          if (business.pincode !== undefined) {
            businessFields.push('pincode = ?');
            businessValues.push(business.pincode);
          }
          if (business.latitude !== undefined) {
            businessFields.push('latitude = ?');
            businessValues.push(business.latitude);
          }
          if (business.longitude !== undefined) {
            businessFields.push('longitude = ?');
            businessValues.push(business.longitude);
          }
          
          if (businessFields.length > 0) {
            businessValues.push(businessId); // for WHERE clause
            await connection.execute(
              `UPDATE businesses SET ${businessFields.join(', ')} WHERE id = ?`,
              businessValues
            );
          }
          
          // Update business settings
          const settingsFields = [];
          const settingsValues = [];
          
          if (business.attendance_method !== undefined) {
            settingsFields.push('attendance_method = ?');
            settingsValues.push(business.attendance_method);
          }
          if (business.work_start_time !== undefined) {
            settingsFields.push('work_start_time = ?');
            settingsValues.push(business.work_start_time);
          }
          if (business.work_end_time !== undefined) {
            settingsFields.push('work_end_time = ?');
            settingsValues.push(business.work_end_time);
          }
          if (business.weekly_off_days !== undefined) {
            settingsFields.push('weekly_off_days = ?');
            settingsValues.push(business.weekly_off_days);
          }
          if (business.salary_cycle !== undefined) {
            settingsFields.push('salary_cycle = ?');
            settingsValues.push(business.salary_cycle);
          }
          
          if (settingsFields.length > 0) {
            settingsValues.push(businessId); // for WHERE clause
            await connection.execute(
              `UPDATE business_settings SET ${settingsFields.join(', ')} WHERE business_id = ?`,
              settingsValues
            );
          }
        }
      }

      await connection.commit();

      // Return updated owner data
      return await BusinessOwner.getById(id);
    } catch (error) {
      await connection.rollback();
      console.error('Error updating business owner:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = BusinessOwner;