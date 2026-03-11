-- Add business_customer_id column to customers table
ALTER TABLE customers 
ADD COLUMN business_customer_id INT NULL AFTER business_id;

-- Add index for better performance
ALTER TABLE customers 
ADD INDEX idx_business_customer_id (business_id, business_customer_id);

-- Update existing customers to have business_customer_id values
-- This will assign sequential IDs within each business
UPDATE customers c1 
SET business_customer_id = (
    SELECT COUNT(*) 
    FROM customers c2 
    WHERE c2.business_id = c1.business_id 
    AND c2.id <= c1.id
    AND c2.is_active = TRUE
) 
WHERE c1.is_active = TRUE;

-- Make the column NOT NULL after populating data
ALTER TABLE customers 
MODIFY COLUMN business_customer_id INT NOT NULL;