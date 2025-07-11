-- Fix infinite recursion in purchase_orders policies
-- The issue is that purchase_orders policies reference vendors table in subqueries,
-- which triggers vendor RLS checks, potentially causing recursion

-- First, drop the problematic policies that were added
DROP POLICY IF EXISTS "Sellers can view vendors in their purchase orders" ON vendors;
DROP POLICY IF EXISTS "Vendors can view sellers who have purchase orders with them" ON sellers;

-- Now, let's ensure purchase_orders policies work without recursion
-- We'll use a more direct approach that doesn't trigger complex RLS checks

-- Temporarily disable RLS to fix the policies
ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;

-- Drop existing policies that might cause issues
DROP POLICY IF EXISTS "Suppliers can view their purchase orders" ON purchase_orders;
DROP POLICY IF EXISTS "Suppliers can update order status" ON purchase_orders;

-- Re-enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Recreate supplier policies with a simpler approach that avoids recursion
-- Instead of subquerying vendors table, we'll use a different approach

-- For vendor users: they can view/update purchase orders where they are the supplier
-- We'll check this by joining with vendors table but using SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION get_vendor_id_for_user(user_id UUID)
RETURNS UUID AS $$
  SELECT id FROM vendors WHERE vendors.user_id = $1 LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Now create policies using this function
CREATE POLICY "Vendors can view their purchase orders" ON purchase_orders
  FOR SELECT USING (
    supplier_id = get_vendor_id_for_user(auth.uid())
    AND status != 'draft'
  );

CREATE POLICY "Vendors can update their purchase orders" ON purchase_orders
  FOR UPDATE USING (
    supplier_id = get_vendor_id_for_user(auth.uid())
    AND status IN ('sent_to_supplier', 'approved', 'in_progress')
  )
  WITH CHECK (
    supplier_id = get_vendor_id_for_user(auth.uid())
  );

-- Make sure the existing seller policies are still in place
-- These should already exist but let's ensure they're correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Sellers can view own purchase orders'
  ) THEN
    CREATE POLICY "Sellers can view own purchase orders" ON purchase_orders
      FOR SELECT USING (seller_id = auth.uid());
  END IF;
END $$;