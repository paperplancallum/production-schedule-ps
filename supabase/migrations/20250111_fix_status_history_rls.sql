-- Fix RLS policies for purchase_order_status_history table

-- Drop existing policies
DROP POLICY IF EXISTS "Sellers can view own PO status history" ON purchase_order_status_history;
DROP POLICY IF EXISTS "Sellers can insert status history" ON purchase_order_status_history;
DROP POLICY IF EXISTS "System can insert status history" ON purchase_order_status_history;
DROP POLICY IF EXISTS "Suppliers can view their PO status history" ON purchase_order_status_history;

-- Create new policies

-- Sellers can view their own PO status history
CREATE POLICY "Sellers can view own PO status history" ON purchase_order_status_history
    FOR SELECT USING (
        purchase_order_id IN (
            SELECT id FROM purchase_orders 
            WHERE seller_id = auth.uid()
        )
    );

-- Sellers can insert status history for their own POs
CREATE POLICY "Sellers can insert status history" ON purchase_order_status_history
    FOR INSERT WITH CHECK (
        purchase_order_id IN (
            SELECT id FROM purchase_orders 
            WHERE seller_id = auth.uid()
        )
    );

-- Suppliers can view status history for their POs
CREATE POLICY "Suppliers can view their PO status history" ON purchase_order_status_history
    FOR SELECT USING (
        purchase_order_id IN (
            SELECT po.id
            FROM purchase_orders po
            JOIN vendors v ON po.supplier_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Suppliers can insert status history when updating their POs
CREATE POLICY "Suppliers can insert status history" ON purchase_order_status_history
    FOR INSERT WITH CHECK (
        purchase_order_id IN (
            SELECT po.id
            FROM purchase_orders po
            JOIN vendors v ON po.supplier_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Also ensure the trigger function exists and works correctly
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

-- Make sure the trigger is attached
DROP TRIGGER IF EXISTS track_status_change ON purchase_orders;
CREATE TRIGGER track_status_change
    AFTER UPDATE OF status ON purchase_orders
    FOR EACH ROW
    EXECUTE FUNCTION track_purchase_order_status_change();