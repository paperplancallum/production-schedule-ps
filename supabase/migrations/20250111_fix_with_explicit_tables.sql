-- Fix RLS policies by using explicit table names instead of aliases
-- This avoids any confusion about column references

-- Drop all existing policies on supplier_price_tiers
DROP POLICY IF EXISTS "Sellers can view own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can create price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can update own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can delete own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Vendors can view their price tiers" ON public.supplier_price_tiers;

-- Recreate with explicit table references (no aliases)
CREATE POLICY "Sellers can view own price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT product_suppliers.id 
            FROM public.product_suppliers
            JOIN public.products ON product_suppliers.product_id = products.id
            WHERE products.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can create price tiers" ON public.supplier_price_tiers
    FOR INSERT WITH CHECK (
        product_supplier_id IN (
            SELECT product_suppliers.id 
            FROM public.product_suppliers
            JOIN public.products ON product_suppliers.product_id = products.id
            WHERE products.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can update own price tiers" ON public.supplier_price_tiers
    FOR UPDATE USING (
        product_supplier_id IN (
            SELECT product_suppliers.id 
            FROM public.product_suppliers
            JOIN public.products ON product_suppliers.product_id = products.id
            WHERE products.seller_id = auth.uid()
        )
    );

CREATE POLICY "Sellers can delete own price tiers" ON public.supplier_price_tiers
    FOR DELETE USING (
        product_supplier_id IN (
            SELECT product_suppliers.id 
            FROM public.product_suppliers
            JOIN public.products ON product_suppliers.product_id = products.id
            WHERE products.seller_id = auth.uid()
        )
    );

-- Vendor policy with explicit table name
CREATE POLICY "Vendors can view their price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT product_suppliers.id 
            FROM public.product_suppliers
            WHERE product_suppliers.vendor_id = auth.uid()
        )
    );