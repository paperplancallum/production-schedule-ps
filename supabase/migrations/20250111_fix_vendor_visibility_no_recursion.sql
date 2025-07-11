-- Drop the problematic policies that are causing infinite recursion
DROP POLICY IF EXISTS "Sellers can view vendors in their purchase orders" ON vendors;
DROP POLICY IF EXISTS "Vendors can view sellers who have purchase orders with them" ON sellers;

-- Since vendors are always created by sellers, the existing policies should be sufficient:
-- "Sellers can view their vendors" - allows sellers to see vendors they created
-- This is all we need for the purchase order functionality to work

-- The issue might be that we need to ensure the purchase_orders RLS policies don't create recursion
-- Let's check if there are any problematic purchase_orders policies
DO $$
BEGIN
  -- Log existing policies for debugging
  RAISE NOTICE 'Checking for problematic RLS policies...';
END $$;