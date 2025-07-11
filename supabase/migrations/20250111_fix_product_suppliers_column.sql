-- Fix the column name in product_suppliers table
-- The table was created with 'supplier_id' but the app uses 'vendor_id'

-- First, drop the existing constraints and indexes
ALTER TABLE product_suppliers DROP CONSTRAINT IF EXISTS product_suppliers_supplier_id_fkey;
DROP INDEX IF EXISTS idx_product_suppliers_supplier_id;

-- Rename the column
ALTER TABLE product_suppliers RENAME COLUMN supplier_id TO vendor_id;

-- Re-add the foreign key constraint
ALTER TABLE product_suppliers 
  ADD CONSTRAINT product_suppliers_vendor_id_fkey 
  FOREIGN KEY (vendor_id) 
  REFERENCES vendors(id) 
  ON DELETE CASCADE;

-- Re-create the index
CREATE INDEX idx_product_suppliers_vendor_id ON product_suppliers(vendor_id);

-- Update the unique constraint to use the new column name
ALTER TABLE product_suppliers DROP CONSTRAINT IF EXISTS product_suppliers_product_id_supplier_id_key;
ALTER TABLE product_suppliers ADD CONSTRAINT product_suppliers_product_id_vendor_id_key UNIQUE(product_id, vendor_id);

-- Now we need to recreate the RLS policies to use the correct column name
-- Drop existing policies
DROP POLICY IF EXISTS "Vendors can view their product relationships" ON product_suppliers;

-- Recreate the vendor view policy with the correct column name
CREATE POLICY "Vendors can view their product relationships" ON product_suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = product_suppliers.vendor_id
      AND v.user_id = auth.uid()
    )
  );