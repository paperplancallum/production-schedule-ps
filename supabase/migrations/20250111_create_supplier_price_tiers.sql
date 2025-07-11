-- Create supplier_price_tiers table
CREATE TABLE IF NOT EXISTS public.supplier_price_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_supplier_id UUID NOT NULL REFERENCES public.product_suppliers(id) ON DELETE CASCADE,
    minimum_order_quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplier_price_tiers_product_supplier_id ON public.supplier_price_tiers(product_supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_price_tiers_moq ON public.supplier_price_tiers(minimum_order_quantity);

-- Enable RLS
ALTER TABLE public.supplier_price_tiers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sellers can view supplier price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can insert supplier price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can update supplier price tiers" ON public.supplier_price_tiers;
DROP POLICY IF EXISTS "Sellers can delete supplier price tiers" ON public.supplier_price_tiers;

-- Create RLS policies
-- Sellers can view price tiers for their product suppliers
CREATE POLICY "Sellers can view supplier price tiers" ON public.supplier_price_tiers
    FOR SELECT USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can add price tiers to their product suppliers
CREATE POLICY "Sellers can insert supplier price tiers" ON public.supplier_price_tiers
    FOR INSERT WITH CHECK (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can update price tiers for their product suppliers
CREATE POLICY "Sellers can update supplier price tiers" ON public.supplier_price_tiers
    FOR UPDATE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can delete price tiers from their product suppliers
CREATE POLICY "Sellers can delete supplier price tiers" ON public.supplier_price_tiers
    FOR DELETE USING (
        product_supplier_id IN (
            SELECT ps.id FROM public.product_suppliers ps
            JOIN public.products p ON ps.product_id = p.id
            WHERE p.seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_supplier_price_tiers_updated_at ON public.supplier_price_tiers;
CREATE TRIGGER update_supplier_price_tiers_updated_at BEFORE UPDATE ON public.supplier_price_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data from product_suppliers to price tiers
-- Each supplier's current MOQ and price becomes their first tier
INSERT INTO public.supplier_price_tiers (product_supplier_id, minimum_order_quantity, unit_price)
SELECT id, minimum_order_quantity, unit_price
FROM public.product_suppliers
WHERE NOT EXISTS (
    SELECT 1 FROM public.supplier_price_tiers 
    WHERE product_supplier_id = public.product_suppliers.id
);

-- Now we can remove the pricing columns from product_suppliers
-- But we'll keep them for now for backward compatibility
-- ALTER TABLE public.product_suppliers DROP COLUMN minimum_order_quantity;
-- ALTER TABLE public.product_suppliers DROP COLUMN unit_price;