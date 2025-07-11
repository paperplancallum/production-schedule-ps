-- Add MOQ (Minimum Order Quantity) column to product_suppliers table only
-- MOQ should be managed at the supplier level, not at the product level

ALTER TABLE product_suppliers 
ADD COLUMN IF NOT EXISTS moq INTEGER;

-- Add a comment to describe the column
COMMENT ON COLUMN product_suppliers.moq IS 'Supplier-specific Minimum Order Quantity for this product';