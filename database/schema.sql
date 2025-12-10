
-- Create database if not exists
CREATE DATABASE IF NOT EXISTS managio_db;

-- Use the database
USE managio_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role ENUM('owner', 'employee') NOT NULL DEFAULT 'owner',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mobile (mobile_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Owner Profiles table
CREATE TABLE IF NOT EXISTS owner_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    business_role VARCHAR(100),
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    date_of_birth DATE,
    profile_picture_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Business table
CREATE TABLE IF NOT EXISTS businesses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(100),
    business_category VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    logo_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Business Settings table
CREATE TABLE IF NOT EXISTS business_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    attendance_method ENUM('qr_scan', 'location', 'manual') DEFAULT 'qr_scan',
    work_start_time TIME DEFAULT '09:00:00',
    work_end_time TIME DEFAULT '17:00:00',
    weekly_off_days SET('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'),
    salary_cycle ENUM('weekly', 'bi_weekly', 'monthly') DEFAULT 'monthly',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    INDEX idx_business (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- OTP Verification table
CREATE TABLE IF NOT EXISTS otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile_number VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    is_used TINYINT(1) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mobile_otp (mobile_number, otp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Attendance Sessions table (for QR code generation)
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    owner_id INT NOT NULL,
    session_id VARCHAR(64) NOT NULL UNIQUE,
    qr_code_data TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_business (business_id),
    INDEX idx_owner (owner_id),
    INDEX idx_session (session_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Employee Attendance Records table
CREATE TABLE IF NOT EXISTS employee_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    business_id INT NOT NULL,
    owner_id INT NOT NULL,
    session_id VARCHAR(64),
    attendance_date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    status ENUM('present', 'absent', 'late', 'half_day') DEFAULT 'present',
    absent_reason TEXT,
    qr_scanned_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES attendance_sessions(session_id) ON DELETE SET NULL,
    UNIQUE KEY unique_employee_date (employee_id, attendance_date),
    INDEX idx_employee (employee_id),
    INDEX idx_business (business_id),
    INDEX idx_date (attendance_date),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
