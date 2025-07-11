-- This SQL can be run directly in the Supabase SQL editor to fix the issues
-- It's a consolidated version of the fix that can be applied immediately

-- 1. Drop problematic policies
DROP POLICY IF EXISTS "Sellers can view vendors in their purchase orders" ON vendors CASCADE;
DROP POLICY IF EXISTS "Vendors can view sellers who have purchase orders with them" ON sellers CASCADE;
DROP POLICY IF EXISTS "Authenticated sellers can view supplier vendors" ON vendors CASCADE;
DROP POLICY IF EXISTS "View vendors referenced in accessible purchase orders" ON vendors CASCADE;
DROP POLICY IF EXISTS "Suppliers can view their purchase orders" ON purchase_orders CASCADE;
DROP POLICY IF EXISTS "Suppliers can update order status" ON purchase_orders CASCADE;
DROP POLICY IF EXISTS "Vendors can view their purchase orders" ON purchase_orders CASCADE;
DROP POLICY IF EXISTS "Vendors can update their purchase orders" ON purchase_orders CASCADE;

-- 2. Create the helper function
CREATE OR REPLACE FUNCTION get_vendor_id_for_user(user_id UUID)
RETURNS UUID AS $$
  SELECT id FROM vendors WHERE vendors.user_id = $1 LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Create new vendor policies for purchase orders
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

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION get_vendor_id_for_user(UUID) TO authenticated;

-- 5. Add documentation
COMMENT ON FUNCTION get_vendor_id_for_user IS 'Returns vendor ID for a given user ID. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion in purchase_orders policies.';