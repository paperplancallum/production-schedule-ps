-- Make vendors.id nullable temporarily to allow creating vendors without profiles
-- This is for development/demo purposes

-- First drop the foreign key constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_id_fkey;

-- Make the id column nullable
ALTER TABLE vendors ALTER COLUMN id DROP NOT NULL;

-- Add a generated vendor_code if it doesn't exist
ALTER TABLE vendors 
ALTER COLUMN vendor_code SET DEFAULT 'V' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');

-- Update the insert policy to allow sellers to create vendors without an id
DROP POLICY IF EXISTS "Sellers can insert vendors" ON vendors;

CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- Also allow sellers to delete their vendors
CREATE POLICY "Sellers can delete their vendors" ON vendors
  FOR DELETE
  USING (seller_id = auth.uid());