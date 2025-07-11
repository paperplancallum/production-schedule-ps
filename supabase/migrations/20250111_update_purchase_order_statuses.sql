-- Update purchase_order_status enum to new values
-- First, we need to handle existing data and the enum change carefully

-- Step 1: Create a temporary enum with new values
CREATE TYPE purchase_order_status_new AS ENUM (
  'draft',
  'sent_to_supplier',
  'approved',
  'in_progress',
  'complete',
  'cancelled'
);

-- Step 2: Add a temporary column
ALTER TABLE purchase_orders ADD COLUMN status_new purchase_order_status_new;

-- Step 3: Map old values to new values
UPDATE purchase_orders 
SET status_new = CASE 
  WHEN status = 'draft' THEN 'draft'::purchase_order_status_new
  WHEN status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status_new
  WHEN status = 'accepted' THEN 'approved'::purchase_order_status_new
  WHEN status = 'in_progress' THEN 'in_progress'::purchase_order_status_new
  WHEN status = 'shipped' THEN 'in_progress'::purchase_order_status_new
  WHEN status = 'delivered' THEN 'complete'::purchase_order_status_new
  WHEN status = 'cancelled' THEN 'cancelled'::purchase_order_status_new
END;

-- Step 4: Update the status history table
ALTER TABLE purchase_order_status_history ADD COLUMN from_status_new purchase_order_status_new;
ALTER TABLE purchase_order_status_history ADD COLUMN to_status_new purchase_order_status_new;

UPDATE purchase_order_status_history 
SET from_status_new = CASE 
  WHEN from_status = 'draft' THEN 'draft'::purchase_order_status_new
  WHEN from_status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status_new
  WHEN from_status = 'accepted' THEN 'approved'::purchase_order_status_new
  WHEN from_status = 'in_progress' THEN 'in_progress'::purchase_order_status_new
  WHEN from_status = 'shipped' THEN 'in_progress'::purchase_order_status_new
  WHEN from_status = 'delivered' THEN 'complete'::purchase_order_status_new
  WHEN from_status = 'cancelled' THEN 'cancelled'::purchase_order_status_new
  ELSE NULL
END,
to_status_new = CASE 
  WHEN to_status = 'draft' THEN 'draft'::purchase_order_status_new
  WHEN to_status = 'submitted' THEN 'sent_to_supplier'::purchase_order_status_new
  WHEN to_status = 'accepted' THEN 'approved'::purchase_order_status_new
  WHEN to_status = 'in_progress' THEN 'in_progress'::purchase_order_status_new
  WHEN to_status = 'shipped' THEN 'in_progress'::purchase_order_status_new
  WHEN to_status = 'delivered' THEN 'complete'::purchase_order_status_new
  WHEN to_status = 'cancelled' THEN 'cancelled'::purchase_order_status_new
END;

-- Step 5: Drop the old columns
ALTER TABLE purchase_orders DROP COLUMN status;
ALTER TABLE purchase_order_status_history DROP COLUMN from_status;
ALTER TABLE purchase_order_status_history DROP COLUMN to_status;

-- Step 6: Rename the new columns
ALTER TABLE purchase_orders RENAME COLUMN status_new TO status;
ALTER TABLE purchase_order_status_history RENAME COLUMN from_status_new TO from_status;
ALTER TABLE purchase_order_status_history RENAME COLUMN to_status_new TO to_status;

-- Step 7: Drop the old enum type
DROP TYPE purchase_order_status;

-- Step 8: Rename the new enum type
ALTER TYPE purchase_order_status_new RENAME TO purchase_order_status;

-- Step 9: Update the default constraint
ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'draft';

-- Step 10: Update the log_purchase_order_status_change function to handle new statuses
CREATE OR REPLACE FUNCTION log_purchase_order_status_change()
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
    
    -- Update relevant timestamps based on new status names
    CASE NEW.status
      WHEN 'sent_to_supplier' THEN
        NEW.submitted_at := NOW();
      WHEN 'approved' THEN
        NEW.accepted_at := NOW();
      WHEN 'cancelled' THEN
        NEW.cancelled_at := NOW();
      ELSE
        -- Do nothing for other statuses
    END CASE;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 11: Update RLS policy for suppliers to use new status names
DROP POLICY IF EXISTS "Suppliers can update order status" ON purchase_orders;

CREATE POLICY "Suppliers can update order status" ON purchase_orders
  FOR UPDATE USING (
    supplier_id IN (
      SELECT id FROM vendors WHERE user_id = auth.uid()
    )
    AND status IN ('sent_to_supplier', 'approved', 'in_progress')
  );