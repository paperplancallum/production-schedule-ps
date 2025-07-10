-- Manually confirm all existing users
-- Run this in Supabase SQL Editor to confirm unconfirmed users

UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Check which users are confirmed
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users
ORDER BY created_at DESC;