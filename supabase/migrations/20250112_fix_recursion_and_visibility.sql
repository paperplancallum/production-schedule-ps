-- This migration fixes the infinite recursion and vendor visibility issues
-- It consolidates the necessary fixes without conflicting with existing schema

-- First, drop any problematic policies that might have been added
DO $$
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Sellers can view vendors in their purchase orders" ON vendors;
  DROP POLICY IF EXISTS "Vendors can view sellers who have purchase orders with them" ON sellers;
  DROP POLICY IF EXISTS "Authenticated sellers can view supplier vendors" ON vendors;
  DROP POLICY IF EXISTS "View vendors referenced in accessible purchase orders" ON vendors;
EXCEPTION
  WHEN undefined_object THEN
    -- Policies don't exist, continue
    NULL;
END $$;

-- Create or replace the function to get vendor ID for a user
-- This avoids RLS recursion by using SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_vendor_id_for_user(user_id UUID)
RETURNS UUID AS $$
  SELECT id FROM vendors WHERE vendors.user_id = $1 LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Drop and recreate vendor-related policies on purchase_orders to avoid recursion
DO $$
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Suppliers can view their purchase orders" ON purchase_orders;
  DROP POLICY IF EXISTS "Suppliers can update order status" ON purchase_orders;
  DROP POLICY IF EXISTS "Vendors can view their purchase orders" ON purchase_orders;
  DROP POLICY IF EXISTS "Vendors can update their purchase orders" ON purchase_orders;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Create new policies using the function to avoid recursion
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

-- Ensure sellers can still manage their purchase orders
-- These should already exist but let's make sure
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Sellers can create purchase orders'
  ) THEN
    CREATE POLICY "Sellers can create purchase orders" ON purchase_orders
      FOR INSERT WITH CHECK (seller_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'purchase_orders' 
    AND policyname = 'Sellers can update own purchase orders'
  ) THEN
    CREATE POLICY "Sellers can update own purchase orders" ON purchase_orders
      FOR UPDATE USING (seller_id = auth.uid());
  END IF;
END $$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_vendor_id_for_user(UUID) TO authenticated;

-- Add a comment to document the fix
COMMENT ON FUNCTION get_vendor_id_for_user IS 'Returns vendor ID for a given user ID. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion in purchase_orders policies.';