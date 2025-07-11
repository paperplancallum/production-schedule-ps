-- Safe migration to update purchase order statuses without dropping columns

-- First, update existing status values to new ones
UPDATE purchase_orders 
SET status = CASE 
    WHEN status = 'submitted' THEN 'sent_to_supplier'
    WHEN status = 'accepted' THEN 'approved'
    WHEN status = 'shipped' THEN 'in_progress'
    WHEN status = 'delivered' THEN 'complete'
    ELSE status
END
WHERE status IN ('submitted', 'accepted', 'shipped', 'delivered');

-- Update status history table
UPDATE purchase_order_status_history
SET from_status = CASE 
    WHEN from_status = 'submitted' THEN 'sent_to_supplier'
    WHEN from_status = 'accepted' THEN 'approved'
    WHEN from_status = 'shipped' THEN 'in_progress'
    WHEN from_status = 'delivered' THEN 'complete'
    ELSE from_status
END
WHERE from_status IN ('submitted', 'accepted', 'shipped', 'delivered');

UPDATE purchase_order_status_history
SET to_status = CASE 
    WHEN to_status = 'submitted' THEN 'sent_to_supplier'
    WHEN to_status = 'accepted' THEN 'approved'
    WHEN to_status = 'shipped' THEN 'in_progress'
    WHEN to_status = 'delivered' THEN 'complete'
    ELSE to_status
END
WHERE to_status IN ('submitted', 'accepted', 'shipped', 'delivered');

-- Now alter the enum type to include new values and remove old ones
-- First, temporarily remove the constraint
ALTER TABLE purchase_orders 
ALTER COLUMN status TYPE TEXT;

ALTER TABLE purchase_order_status_history 
ALTER COLUMN from_status TYPE TEXT,
ALTER COLUMN to_status TYPE TEXT;

-- Drop the old enum type
DROP TYPE IF EXISTS purchase_order_status CASCADE;

-- Create new enum type with updated values
CREATE TYPE purchase_order_status AS ENUM (
    'draft',
    'sent_to_supplier',
    'approved',
    'in_progress',
    'complete',
    'cancelled'
);

-- Apply the new enum type
ALTER TABLE purchase_orders 
ALTER COLUMN status TYPE purchase_order_status 
USING status::purchase_order_status;

ALTER TABLE purchase_order_status_history 
ALTER COLUMN from_status TYPE purchase_order_status 
USING from_status::purchase_order_status,
ALTER COLUMN to_status TYPE purchase_order_status 
USING to_status::purchase_order_status;

-- Update the trigger function to use new status names
CREATE OR REPLACE FUNCTION track_purchase_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO purchase_order_status_history (
            purchase_order_id,
            from_status,
            to_status,
            changed_by
        ) VALUES (
            NEW.id,
            OLD.status,
            NEW.status,
            auth.uid()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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