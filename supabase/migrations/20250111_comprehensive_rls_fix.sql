-- Comprehensive fix for all RLS policies that might reference ps.supplier_id
-- First, drop ALL existing policies on supplier_price_tiers to start fresh

DROP POLICY IF EXISTS "Sellers can view own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can create price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can update own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can delete own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Vendors can view their price tiers" ON public.supplier_price_tiers;

-- Check and drop any other policies that might exist
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'supplier_price_tiers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.supplier_price_tiers', pol.policyname);
    END LOOP;
END $$;

-- Now recreate the policies with correct column references
-- Sellers policies
CREATE POLICY "Sellers can view own price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can create price tiers" ON public.supplier_price_tiers
    FOR INSERT WITH CHECK (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can update own price tiers" ON public.supplier_price_tiers
    FOR UPDATE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can delete own price tiers" ON public.supplier_price_tiers
    FOR DELETE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id = auth.uid()
        )
    );

-- Vendor policy
CREATE POLICY "Vendors can view their price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            WHERE ps.vendor_id = auth.uid()
        )
    );

-- Also check product_suppliers table policies
-- Drop any existing policies that might have wrong references
DROP POLICY IF EXISTS "Sellers can view product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Sellers can manage product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Vendors can view their product suppliers" ON public.product_suppliers;

-- Recreate product_suppliers policies with correct references
CREATE POLICY "Sellers can view product suppliers" ON public.product_suppliers
    FOR SELECT USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can manage product suppliers" ON public.product_suppliers
    FOR ALL USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can view their product suppliers" ON public.product_suppliers
    FOR SELECT USING (
        vendor_id = auth.uid()
    );

-- Also check purchase_order_items table policies
DROP POLICY IF EXISTS "Sellers can view own purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Sellers can manage own purchase order items" ON public.purchase_order_items;

-- Recreate purchase_order_items policies
CREATE POLICY "Sellers can view own purchase order items" ON public.purchase_order_items
    FOR SELECT USING (
        purchase_order_id IN (
            SELECT id FROM public.purchase_orders 
            WHERE seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can manage own purchase order items" ON public.purchase_order_items
    FOR ALL USING (
        purchase_order_id IN (
            SELECT id FROM public.purchase_orders 
            WHERE seller_id = auth.uid()
        )
    );