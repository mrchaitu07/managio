-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    role VARCHAR(100) NOT NULL,
    photo_url VARCHAR(255),
    employee_type ENUM('Full-Time', 'Part-Time', 'Contract', 'Intern') NOT NULL DEFAULT 'Full-Time',
    joining_date DATE NOT NULL,
    salary_type ENUM('Monthly', 'Daily', 'Hourly') NOT NULL DEFAULT 'Monthly',
    salary_amount DECIMAL(10, 2) NOT NULL,
    emergency_contact_name VARCHAR(100),
    emergency_contact_number VARCHAR(15),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_mobile (mobile_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
