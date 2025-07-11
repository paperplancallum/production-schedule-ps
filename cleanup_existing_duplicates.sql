-- First, see how many duplicates we have
SELECT COUNT(*) as total_duplicate_records
FROM (
    WITH duplicates AS (
        SELECT 
            id,
            purchase_order_id,
            from_status,
            to_status,
            created_at,
            changed_by,
            ROW_NUMBER() OVER (
                PARTITION BY purchase_order_id, from_status, to_status, 
                DATE_TRUNC('second', created_at), changed_by
                ORDER BY id
            ) as rn
        FROM purchase_order_status_history
    )
    SELECT id FROM duplicates WHERE rn > 1
) as dup_count;

-- Delete the duplicates (keeping the first one of each group)
WITH duplicates AS (
    SELECT 
        id,
        purchase_order_id,
        from_status,
        to_status,
        created_at,
        changed_by,
        ROW_NUMBER() OVER (
            PARTITION BY purchase_order_id, from_status, to_status, 
            DATE_TRUNC('second', created_at), changed_by
            ORDER BY id
        ) as rn
    FROM purchase_order_status_history
)
DELETE FROM purchase_order_status_history
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
)
RETURNING id;

-- Verify the cleanup - show the clean status history for our test PO
SELECT 
    id,
    from_status,
    to_status,
    created_at,
    changed_by,
    notes
FROM purchase_order_status_history
WHERE purchase_order_id = 'db7293d9-9ff1-4c09-b396-f8993bb3dce3'
ORDER BY created_at DESC;