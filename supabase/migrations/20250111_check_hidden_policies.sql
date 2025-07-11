-- Check for any policies that might have ps.supplier_id reference
-- Sometimes the error comes from views or functions with embedded security

-- Check all policies more thoroughly
SELECT 
    n.nspname as schemaname,
    c.relname as tablename,
    pol.polname as policyname,
    pol.polcmd as cmd,
    pg_get_expr(pol.polqual, pol.polrelid) as qual,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND pg_get_expr(pol.polqual, pol.polrelid)::text LIKE '%ps.supplier_id%'
OR pg_get_expr(pol.polwithcheck, pol.polrelid)::text LIKE '%ps.supplier_id%';

-- Check if there are any functions that might contain the reference
SELECT 
    proname,
    prosrc
FROM pg_proc
WHERE prosrc LIKE '%ps.supplier_id%';

-- Check views that might have the reference
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%ps.supplier_id%';

-- Let's also check the exact error by looking at all policies on supplier_price_tiers with full details
SELECT 
    pol.polname as policy_name,
    CASE pol.polcmd 
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        ELSE 'ALL'
    END as command,
    pg_get_expr(pol.polqual, pol.polrelid, true) as using_expression,
    pg_get_expr(pol.polwithcheck, pol.polrelid, true) as with_check_expression
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname = 'supplier_price_tiers';