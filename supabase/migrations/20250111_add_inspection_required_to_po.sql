-- Add inspection_required field to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN inspection_required BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN purchase_orders.inspection_required IS 'Whether this PO requires inspection. Default is true. Can be set to false to exclude from inspections.';

-- Update existing orders to have inspection_required = true
UPDATE purchase_orders SET inspection_required = true WHERE inspection_required IS NULL;