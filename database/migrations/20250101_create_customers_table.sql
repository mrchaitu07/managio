-- Create Customers table
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_mobile VARCHAR(15),
    customer_email VARCHAR(100),
    customer_address TEXT,

    balance_due DECIMAL(10, 2) DEFAULT 0.00,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    INDEX idx_business (business_id),
    INDEX idx_customer_name (customer_name),
    INDEX idx_customer_mobile (customer_mobile),
    INDEX idx_customer_email (customer_email),
    INDEX idx_customer_type (customer_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;