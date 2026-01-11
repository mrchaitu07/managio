CREATE TABLE holidays (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_id INT NOT NULL,
    holiday_date DATE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_business_date (business_id, holiday_date)
);