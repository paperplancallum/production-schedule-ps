-- Find all vendors that have created accounts but aren't showing as accepted
SELECT 
  v.id,
  v.email,
  v.vendor_status,
  v.user_id,
  u.id as auth_user_id,
  u.created_at as user_created_at
FROM vendors v
LEFT JOIN auth.users u ON v.email = u.email
WHERE v.vendor_status = 'invited'
  AND u.id IS NOT NULL;

-- Update all vendors that have auth accounts to accepted status
UPDATE vendors v
SET 
  vendor_status = 'accepted',
  user_id = u.id
FROM auth.users u
WHERE v.email = u.email
  AND v.vendor_status = 'invited'
  AND u.id IS NOT NULL;

-- Verify the updates
SELECT 
  email,
  vendor_status,
  user_id,
  CASE 
    WHEN user_id IS NOT NULL THEN 'Linked to user'
    ELSE 'Not linked'
  END as link_status
FROM vendors
WHERE email IN ('callum+3@paperplan.co', 'callum+4@paperplan.co')
ORDER BY created_at DESC;