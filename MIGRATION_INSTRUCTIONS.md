# Database Migrations Required

The application requires new database columns to be added. Please run the following SQL commands in your Supabase SQL Editor:

## Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/umpyksvodclguitcwcmv/sql/new

2. Copy and paste the following SQL:

```sql
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

-- Add phone and wechat columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS wechat VARCHAR(100);

-- Add comments explaining the fields
COMMENT ON COLUMN vendors.phone IS 'Optional phone number for the vendor';
COMMENT ON COLUMN vendors.wechat IS 'Optional WeChat ID for the vendor';
```

3. Click "Run" to execute the migration

## What these migrations add:

### Goods Ready Date:
- A `goods_ready_date` column to the `purchase_orders` table
- Automatically calculates default goods ready dates for all existing POs based on order date + longest lead time
- New POs will have their goods ready date automatically calculated when created
- The date updates automatically when PO items are modified

### Vendor Contact Fields:
- A `phone` column to the `vendors` table (optional)
- A `wechat` column to the `vendors` table (optional)
- These fields allow vendors to provide additional contact information

## After running the migrations:
- Refresh your application
- All purchase orders will now have a goods ready date
- The goods ready date picker should now work properly on the vendor purchase order detail page
- Draft POs will show "(calculated)" next to the goods ready date to indicate it's automatically set
- Vendor forms will now include optional Phone and WeChat fields
- The supplier information in inspections will display phone and WeChat when available