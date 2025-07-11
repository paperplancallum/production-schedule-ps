-- First, let's verify the auth.uid() issue
SELECT 
  auth.uid() as auth_uid,
  CASE 
    WHEN auth.uid() IS NULL THEN 'NULL - Not authenticated in SQL editor'
    ELSE 'Authenticated as: ' || auth.uid()
  END as auth_status;

-- Since you can't use auth.uid() in SQL editor, let's check the data directly
-- This query bypasses RLS to see the actual data
SELECT 
  'Purchase Order' as record_type,
  po.id,
  po.po_number,
  po.seller_id,
  po.supplier_id,
  s.company_name as seller_company
FROM purchase_orders po
JOIN sellers s ON s.id = po.seller_id
WHERE po.id = 'db7293d9-9ff1-4c09-b396-f8993bb3dce3'

UNION ALL

SELECT 
  'Vendor' as record_type,
  v.id,
  v.vendor_name,
  v.seller_id,
  NULL as supplier_id,
  s.company_name as seller_company
FROM vendors v
JOIN sellers s ON s.id = v.seller_id
WHERE v.id = '7b120ee8-318f-4092-905d-9231d089a501';

-- The real issue: When you access the app as user bb150d6a-e31e-41d7-9218-7cf6f94829e6,
-- the RLS policy should allow you to see vendors where seller_id = 'bb150d6a-e31e-41d7-9218-7cf6f94829e6'
-- Let's create a more explicit policy

-- Create a temporary solution - a more explicit vendor access policy
DO $$
BEGIN
  -- Drop any conflicting policies
  DROP POLICY IF EXISTS "Explicit seller vendor access" ON vendors;
  
  -- Create new explicit policy
  CREATE POLICY "Explicit seller vendor access" ON vendors
    FOR SELECT
    USING (
      seller_id = auth.uid() 
      OR seller_id IN (
        SELECT id FROM sellers WHERE id = auth.uid()
      )
    );
END $$;