-- Check current vendor update policies
SELECT pol.polname, pol.polcmd, 
       pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
       pg_get_expr(pol.polwith, pol.polrelid) as with_check
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'vendors' AND pol.polcmd = 'w';

-- Drop existing update policies to recreate them properly
DROP POLICY IF EXISTS "Sellers can update their vendors" ON vendors;
DROP POLICY IF EXISTS "Allow vendor signup completion" ON vendors;
DROP POLICY IF EXISTS "Vendors can update their own records" ON vendors;

-- Create comprehensive update policy for vendors table
CREATE POLICY "Allow vendor updates" ON vendors
  FOR UPDATE
  USING (
    -- Sellers can update their own vendors
    seller_id = auth.uid()
    OR
    -- Allow updates during signup (when user is not authenticated yet)
    -- This is for the vendor signup flow
    (auth.uid() IS NULL AND invitation_token IS NOT NULL AND vendor_status = 'invited')
    OR
    -- Allow authenticated vendors to update their own records
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Sellers can update anything for their vendors
    seller_id = auth.uid()
    OR
    -- During signup, only allow setting accepted status and user_id
    (auth.uid() IS NULL AND vendor_status = 'accepted' AND user_id IS NOT NULL)
    OR
    -- Vendors can update their own records
    user_id = auth.uid()
  );

-- Also ensure the vendor can be found by invitation token during signup
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
    -- Allow anonymous access for any vendor with an invitation token
    -- This ensures the signup page can find the vendor
    invitation_token IS NOT NULL
  );

-- Debug: Check if there are any vendors with the email in question
SELECT id, email, vendor_status, user_id, invitation_token, accepted_at
FROM vendors
WHERE email = 'callum+3@paperplan.co';

-- If the vendor exists but status wasn't updated, you can manually fix it:
-- UPDATE vendors 
-- SET vendor_status = 'accepted', 
--     accepted_at = NOW()
-- WHERE email = 'callum+3@paperplan.co' 
-- AND user_id IS NOT NULL;