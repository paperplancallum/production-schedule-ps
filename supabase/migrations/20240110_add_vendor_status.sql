-- Add vendor_status column to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'draft' 
CHECK (vendor_status IN ('draft', 'invited', 'accepted', 'archived'));

-- Create an index on vendor_status for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_status ON vendors(vendor_status);

-- Update existing vendors to have 'accepted' status if they have an id (are connected to a profile)
UPDATE vendors 
SET vendor_status = 'accepted' 
WHERE id IS NOT NULL AND vendor_status IS NULL;

-- Update existing vendors to have 'draft' status if they don't have an id
UPDATE vendors 
SET vendor_status = 'draft' 
WHERE id IS NULL AND vendor_status IS NULL;

-- For vendors table, let's properly handle the id column
-- Instead of making it nullable, let's use a different approach
-- We'll keep id as required for profile-based vendors
-- But for draft vendors, we'll create them with a temporary UUID that's not linked to a profile

-- First, let's add a column to track if a vendor is profile-linked
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS is_profile_linked BOOLEAN DEFAULT false;

-- Update existing vendors that have a valid profile id
UPDATE vendors v
SET is_profile_linked = true
WHERE EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = v.id
);

-- Now let's modify the RLS policies to handle both types of vendors
DROP POLICY IF EXISTS "Sellers can insert vendors" ON vendors;

CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can delete their vendors" ON vendors;

CREATE POLICY "Sellers can delete their vendors" ON vendors
  FOR DELETE
  USING (seller_id = auth.uid());