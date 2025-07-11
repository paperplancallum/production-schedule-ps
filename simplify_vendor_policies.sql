-- Simplify vendor RLS policies to fix access issues
-- Run this in Supabase SQL editor

-- First, let's see all current policies again
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'vendors' AND cmd = 'SELECT'
ORDER BY policyname;

-- Now let's simplify by removing redundant policies and creating one clear policy
DO $$
BEGIN
  -- Drop all SELECT policies on vendors
  DROP POLICY IF EXISTS "Allow vendor access" ON vendors;
  DROP POLICY IF EXISTS "Vendors can view their own records" ON vendors;
  DROP POLICY IF EXISTS "Sellers can view their vendors" ON vendors;
  DROP POLICY IF EXISTS "Explicit seller vendor access" ON vendors;
  
  -- Create one comprehensive SELECT policy
  CREATE POLICY "Comprehensive vendor access" ON vendors
    FOR SELECT
    USING (
      -- Sellers can see vendors they created
      seller_id = auth.uid()
      -- Vendors can see their own record
      OR user_id = auth.uid()
      -- Public access for invited vendors (during invitation flow)
      OR (invitation_token IS NOT NULL AND vendor_status = 'invited')
    );
  
  RAISE NOTICE 'Vendor SELECT policies have been simplified';
END $$;

-- Verify the new policy
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'vendors' AND cmd = 'SELECT'
ORDER BY policyname;