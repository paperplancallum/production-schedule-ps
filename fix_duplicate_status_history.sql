-- First, let's see all triggers on purchase_orders
SELECT 
    tgname AS trigger_name,
    proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'purchase_orders'::regclass
    AND tgname NOT LIKE 'RI_%'
    AND tgname NOT LIKE '%_pkey%'
ORDER BY tgname;

-- Check if there are multiple triggers doing the same thing
SELECT 
    event_object_table,
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'purchase_orders'
    AND trigger_name NOT LIKE 'RI_%';

-- Clean up duplicate status history entries (keep only the earliest)
WITH duplicates AS (
    SELECT 
        id,
        purchase_order_id,
        from_status,
        to_status,
        created_at,
        changed_by,
        ROW_NUMBER() OVER (
            PARTITION BY purchase_order_id, from_status, to_status, created_at, changed_by
            ORDER BY id
        ) as rn
    FROM purchase_order_status_history
)
DELETE FROM purchase_order_status_history
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Disable any duplicate triggers
-- First check what we have, then we'll disable extras
DO $$
DECLARE
    trigger_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT tgname) INTO trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'purchase_orders'::regclass
        AND tgname LIKE '%status%'
        AND tgname NOT LIKE 'RI_%';
    
    RAISE NOTICE 'Found % status-related triggers on purchase_orders', trigger_count;
END $$;