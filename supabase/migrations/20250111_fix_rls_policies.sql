-- Fix RLS policies that are referencing ps.supplier_id (which doesn't exist)
-- The column is actually ps.vendor_id

-- Drop and recreate RLS policies for supplier_price_tiers
DROP POLICY IF EXISTS "Sellers can view own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can create price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can update own price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can delete own price tiers" ON public.supplier_price_tiers;

-- Recreate policies with correct column reference
CREATE POLICY "Sellers can view own price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Sellers can create price tiers" ON public.supplier_price_tiers
    FOR INSERT WITH CHECK (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Sellers can update own price tiers" ON public.supplier_price_tiers
    FOR UPDATE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers WHERE id = auth.uid()
            )
        )
    );

CREATE POLICY "Sellers can delete own price tiers" ON public.supplier_price_tiers
    FOR DELETE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers WHERE id = auth.uid()
            )
        )
    );