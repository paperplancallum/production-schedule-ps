-- Fix the foreign key constraint name for supplier_id in purchase_orders table
-- This allows us to use the proper Supabase foreign key syntax

-- First, drop the existing foreign key constraint
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_fkey;

-- Re-add the foreign key constraint with explicit name
ALTER TABLE purchase_orders 
ADD CONSTRAINT purchase_orders_supplier_id_fkey 
FOREIGN KEY (supplier_id) REFERENCES vendors(id) ON DELETE CASCADE;