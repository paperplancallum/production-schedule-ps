-- Check for duplicate triggers on purchase_orders table
SELECT 
    tgname AS trigger_name,
    tgtype,
    proname AS function_name,
    tgenabled AS enabled
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'purchase_orders'::regclass
    AND tgname NOT LIKE 'RI_%'  -- Exclude foreign key triggers
ORDER BY tgname;

-- Check recent status history to see duplicates
SELECT 
    id,
    purchase_order_id,
    from_status,
    to_status,
    created_at,
    changed_by,
    notes
FROM purchase_order_status_history
WHERE purchase_order_id = 'db7293d9-9ff1-4c09-b396-f8993bb3dce3'
ORDER BY created_at DESC
LIMIT 20;

-- Count duplicates
WITH duplicate_check AS (
    SELECT 
        purchase_order_id,
        from_status,
        to_status,
        created_at,
        changed_by,
        COUNT(*) as duplicate_count
    FROM purchase_order_status_history
    WHERE purchase_order_id = 'db7293d9-9ff1-4c09-b396-f8993bb3dce3'
    GROUP BY purchase_order_id, from_status, to_status, created_at, changed_by
    HAVING COUNT(*) > 1
)
SELECT * FROM duplicate_check;