-- Fix vendors table to allow creating vendors without profiles
-- This properly handles the vendor lifecycle: Draft -> Invited -> Accepted

-- First, we need to modify the vendors table structure
-- Drop the existing foreign key constraint
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_id_fkey;

-- Make id nullable since draft vendors won't have profiles yet
ALTER TABLE vendors ALTER COLUMN id DROP NOT NULL;

-- Add back the foreign key but allow NULL
ALTER TABLE vendors 
ADD CONSTRAINT vendors_id_fkey 
FOREIGN KEY (id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Add a unique identifier for vendors that's separate from profile id
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_uuid UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL;

-- Add vendor_status if it doesn't exist
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_status TEXT DEFAULT 'draft' 
CHECK (vendor_status IN ('draft', 'invited', 'accepted', 'archived'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_uuid ON vendors(vendor_uuid);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_status ON vendors(vendor_status);

-- Update RLS policies
DROP POLICY IF EXISTS "Sellers can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can view their vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can update their vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can delete their vendors" ON vendors;

-- Allow sellers to manage their vendors
CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can view their vendors" ON vendors
  FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can update their vendors" ON vendors
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their vendors" ON vendors
  FOR DELETE
  USING (seller_id = auth.uid());

-- Vendors can also view their own data once they have a profile
CREATE POLICY "Vendors can view own data" ON vendors
  FOR SELECT
  USING (id = auth.uid());