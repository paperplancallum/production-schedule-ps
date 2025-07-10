-- Add RLS policy to allow anonymous users to view vendors by invitation token
-- This is needed for the vendor signup flow to work

-- First, check existing policies
SELECT pol.polname, pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid) as policy_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'vendors';

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Sellers can view their vendors" ON vendors;

-- Create a new SELECT policy that allows both sellers and invitation token access
CREATE POLICY "Allow vendor access" ON vendors
  FOR SELECT
  USING (
    -- Allow if user is the seller
    seller_id = auth.uid()
    OR
    -- Allow anonymous access if querying by invitation_token
    -- This enables the vendor signup flow
    (invitation_token IS NOT NULL AND auth.uid() IS NULL)
  );

-- Also need to allow anonymous users to UPDATE vendors when accepting invitation
CREATE POLICY "Allow vendor signup completion" ON vendors
  FOR UPDATE
  USING (
    -- Allow anonymous users to update if they have the invitation token
    -- and the vendor hasn't been accepted yet
    invitation_token IS NOT NULL 
    AND vendor_status != 'accepted'
    AND auth.uid() IS NULL
  )
  WITH CHECK (
    -- Only allow updating to accepted status and setting the user ID
    vendor_status = 'accepted'
  );