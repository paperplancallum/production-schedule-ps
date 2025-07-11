# Database Migration Required

The application requires a new database column to be added. Please run the following SQL command in your Supabase SQL Editor:

## Steps:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard/project/umpyksvodclguitcwcmv/sql/new

2. Copy and paste the following SQL:

```sql
-- Add goods_ready_date column to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS goods_ready_date DATE;

-- Add comment explaining the field
COMMENT ON COLUMN purchase_orders.goods_ready_date IS 'The date when goods are expected to be ready for pickup/delivery, typically calculated as order date + longest lead time';
```

3. Click "Run" to execute the migration

## What this adds:
- A `goods_ready_date` column to the `purchase_orders` table
- This allows vendors to set and update the expected goods ready date when approving purchase orders
- The date is automatically calculated based on the order date + the longest lead time of items in the PO

## After running the migration:
- Refresh your application
- The goods ready date picker should now work properly on the vendor purchase order detail page