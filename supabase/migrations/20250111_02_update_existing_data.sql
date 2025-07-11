-- Step 2: Update existing data to use new values
-- Run this AFTER the first migration has been committed

-- Update existing data to use new values
UPDATE purchase_orders 
SET status = CASE 
    WHEN status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status
    WHEN status = 'accepted' THEN 'approved'::purchase_order_status
    WHEN status = 'shipped' THEN 'in_progress'::purchase_order_status
    WHEN status = 'delivered' THEN 'complete'::purchase_order_status
    ELSE status
END
WHERE status::text IN ('submitted', 'accepted', 'shipped', 'delivered');

-- Update status history table
UPDATE purchase_order_status_history
SET from_status = CASE 
    WHEN from_status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status
    WHEN from_status = 'accepted' THEN 'approved'::purchase_order_status
    WHEN from_status = 'shipped' THEN 'in_progress'::purchase_order_status
    WHEN from_status = 'delivered' THEN 'complete'::purchase_order_status
    ELSE from_status
END
WHERE from_status::text IN ('submitted', 'accepted', 'shipped', 'delivered');

UPDATE purchase_order_status_history
SET to_status = CASE 
    WHEN to_status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status
    WHEN to_status = 'accepted' THEN 'approved'::purchase_order_status
    WHEN to_status = 'shipped' THEN 'in_progress'::purchase_order_status
    WHEN to_status = 'delivered' THEN 'complete'::purchase_order_status
    ELSE to_status
END
WHERE to_status::text IN ('submitted', 'accepted', 'shipped', 'delivered');

-- Update RLS policies to use new status values
DROP POLICY IF EXISTS "Suppliers can update order status" ON purchase_orders;
CREATE POLICY "Suppliers can update order status" ON purchase_orders
    FOR UPDATE USING (
        supplier_id IN (
            SELECT id FROM vendors WHERE user_id = auth.uid()
        ) 
        AND status IN ('sent_to_supplier', 'approved', 'in_progress')
    );

-- Update purchase_order_items policies
DROP POLICY IF EXISTS "Sellers can create PO items" ON purchase_order_items;
CREATE POLICY "Sellers can create PO items" ON purchase_order_items
    FOR INSERT WITH CHECK (
        purchase_order_id IN (
            SELECT id FROM purchase_orders 
            WHERE seller_id = auth.uid() 
            AND status = 'draft'
        )
    );

DROP POLICY IF EXISTS "Sellers can update own PO items" ON purchase_order_items;
CREATE POLICY "Sellers can update own PO items" ON purchase_order_items
    FOR UPDATE USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders 
            WHERE seller_id = auth.uid() 
            AND status = 'draft'
        )
    );

DROP POLICY IF EXISTS "Sellers can delete own PO items" ON purchase_order_items;
CREATE POLICY "Sellers can delete own PO items" ON purchase_order_items
    FOR DELETE USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders 
            WHERE seller_id = auth.uid() 
            AND status = 'draft'
        )
    );