-- Simple migration to just add vendor_status column
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'draft' 
CHECK (vendor_status IN ('draft', 'invited', 'accepted', 'archived'));

-- Make sure vendors table can be inserted into by sellers
DROP POLICY IF EXISTS "Sellers can insert vendors" ON vendors;

CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- Also ensure sellers can view and update their vendors
DROP POLICY IF EXISTS "Sellers can view their vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can update their vendors" ON vendors;

CREATE POLICY "Sellers can view their vendors" ON vendors
  FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can update their vendors" ON vendors
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());