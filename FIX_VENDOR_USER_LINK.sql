-- Fix vendor-user linking issue
-- Add user_id column to vendors table to properly link vendors to auth users

-- First, add the user_id column if it doesn't exist
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create an index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);

-- Update the RLS policies to work with user_id
DROP POLICY IF EXISTS "Allow vendor access" ON vendors;

CREATE POLICY "Allow vendor access" ON vendors
  FOR SELECT
  USING (
    -- Allow if user is the seller
    seller_id = auth.uid()
    OR
    -- Allow if user is the vendor (authenticated)
    user_id = auth.uid()
    OR
    -- Allow anonymous access if querying by invitation_token
    -- This enables the vendor signup flow
    (invitation_token IS NOT NULL AND auth.uid() IS NULL)
  );

-- Update the vendor signup completion policy
DROP POLICY IF EXISTS "Allow vendor signup completion" ON vendors;

CREATE POLICY "Allow vendor signup completion" ON vendors
  FOR UPDATE
  USING (
    -- Allow sellers to update their vendors
    seller_id = auth.uid()
    OR
    -- Allow anonymous users to update if they have the invitation token
    -- and the vendor hasn't been accepted yet
    (invitation_token IS NOT NULL 
     AND vendor_status != 'accepted'
     AND auth.uid() IS NULL)
  )
  WITH CHECK (
    -- Sellers can update anything
    seller_id = auth.uid()
    OR
    -- Anonymous users can only set accepted status and user_id
    (vendor_status = 'accepted' AND user_id IS NOT NULL)
  );

-- Also allow vendors to view their own records
CREATE POLICY "Vendors can view their own records" ON vendors
  FOR SELECT
  USING (user_id = auth.uid());

-- Allow vendors to update their own records (for future features)
CREATE POLICY "Vendors can update their own records" ON vendors
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());