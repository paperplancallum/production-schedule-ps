-- Add goods_ready_date column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN goods_ready_date DATE;

-- Add comment explaining the field
COMMENT ON COLUMN purchase_orders.goods_ready_date IS 'The date when goods are expected to be ready for pickup/delivery, typically calculated as order date + longest lead time';