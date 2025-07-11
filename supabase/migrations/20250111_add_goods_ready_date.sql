-- Add goods_ready_date column to purchase_orders table if it doesn't exist
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS goods_ready_date DATE;

-- Add comment explaining the field
COMMENT ON COLUMN purchase_orders.goods_ready_date IS 'The date when goods are expected to be ready for pickup/delivery, typically calculated as order date + longest lead time';

-- Update existing purchase orders with calculated goods_ready_date
-- This will set goods_ready_date = order_date + max(lead_time_days) for each PO
UPDATE purchase_orders po
SET goods_ready_date = COALESCE(
  po.goods_ready_date,  -- Keep existing value if already set
  (
    SELECT (po.created_at::date + COALESCE(MAX(ps.lead_time_days), 0))::date
    FROM purchase_order_items poi
    JOIN product_suppliers ps ON ps.id = poi.product_supplier_id
    WHERE poi.purchase_order_id = po.id
  ),
  po.created_at::date  -- Default to order date if no items or no lead times
)
WHERE po.goods_ready_date IS NULL;