-- Find the auth user for this vendor
SELECT id, email, created_at
FROM auth.users
WHERE email = 'callum+3@paperplan.co';

-- Once you have the user ID from above, update the vendor record
-- Replace 'USER_ID_HERE' with the actual ID from the query above
-- UPDATE vendors 
-- SET vendor_status = 'accepted',
--     user_id = 'USER_ID_HERE'
-- WHERE email = 'callum+3@paperplan.co';

-- Alternative: Update in one query if the user exists
UPDATE vendors 
SET vendor_status = 'accepted',
    user_id = (SELECT id FROM auth.users WHERE email = 'callum+3@paperplan.co' LIMIT 1)
WHERE email = 'callum+3@paperplan.co'
AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'callum+3@paperplan.co');

-- Verify the update worked
SELECT id, email, vendor_status, user_id
FROM vendors
WHERE email = 'callum+3@paperplan.co';