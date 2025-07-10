-- Consolidate vendors tables: drop old vendors table and rename vendors_simple to vendors

-- First, drop the old vendors table (with CASCADE to handle any dependencies)
DROP TABLE IF EXISTS vendors CASCADE;

-- Then rename vendors_simple to vendors
ALTER TABLE vendors_simple RENAME TO vendors;

-- Update any indexes to reflect the new table name
ALTER INDEX idx_vendors_simple_seller_id RENAME TO idx_vendors_seller_id;
ALTER INDEX idx_vendors_simple_vendor_status RENAME TO idx_vendors_vendor_status;
ALTER INDEX idx_vendors_simple_vendor_type RENAME TO idx_vendors_vendor_type;

-- The RLS policies will automatically follow the table rename