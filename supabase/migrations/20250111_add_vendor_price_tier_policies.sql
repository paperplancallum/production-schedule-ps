-- Add RLS policies for vendors to view price tiers

-- Vendors can view price tiers for products they supply
CREATE POLICY "Vendors can view their price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            WHERE ps.vendor_id = auth.uid()
        )
    );

-- Note: Vendors should not be able to insert, update, or delete price tiers
-- Only sellers manage price tiers