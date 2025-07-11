-- Step 1: Add new values to the existing enum
-- Run this migration FIRST and commit it

ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'sent_to_supplier' AFTER 'draft';
ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'approved' AFTER 'sent_to_supplier';
ALTER TYPE purchase_order_status ADD VALUE IF NOT EXISTS 'complete' AFTER 'in_progress';