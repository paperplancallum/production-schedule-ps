-- Diagnostic query to find all policies that might reference ps.supplier_id
-- Run this BEFORE the fix to see what policies exist

-- List all policies on relevant tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('supplier_price_tiers', 'product_suppliers', 'purchase_order_items')
ORDER BY tablename, policyname;

-- Search for any policy definitions containing 'supplier_id'
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND (
    qual::text ILIKE '%supplier_id%' 
    OR with_check::text ILIKE '%supplier_id%'
)
ORDER BY tablename, policyname;

-- Check the actual columns in product_suppliers table
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'product_suppliers'
ORDER BY ordinal_position;