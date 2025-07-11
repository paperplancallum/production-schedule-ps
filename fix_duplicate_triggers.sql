-- Fix duplicate status history triggers

-- First, let's see what each function does
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc
WHERE proname IN ('track_purchase_order_status_change', 'log_purchase_order_status_change');

-- Drop the duplicate trigger (keeping track_status_change as it seems to be the newer one)
DROP TRIGGER IF EXISTS log_po_status_change ON purchase_orders;

-- Also drop the function if it's not used elsewhere
DROP FUNCTION IF EXISTS log_purchase_order_status_change() CASCADE;

-- Clean up all duplicate status history entries
WITH duplicates AS (
    SELECT 
        id,
        purchase_order_id,
        from_status,
        to_status,
        created_at,
        changed_by,
        ROW_NUMBER() OVER (
            PARTITION BY purchase_order_id, from_status, to_status, created_at
            ORDER BY id
        ) as rn
    FROM purchase_order_status_history
)
DELETE FROM purchase_order_status_history
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- Verify we now have only one trigger for status changes
SELECT 
    tgname AS trigger_name,
    proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'purchase_orders'::regclass
    AND tgname LIKE '%status%'
ORDER BY tgname;

-- Count how many records were cleaned up
SELECT 
    'Cleaned up ' || COUNT(*) || ' duplicate status history entries' as result
FROM (
    SELECT 
        purchase_order_id,
        from_status,
        to_status,
        created_at,
        COUNT(*) - 1 as duplicates_removed
    FROM purchase_order_status_history
    GROUP BY purchase_order_id, from_status, to_status, created_at
    HAVING COUNT(*) > 1
) AS cleanup_stats;