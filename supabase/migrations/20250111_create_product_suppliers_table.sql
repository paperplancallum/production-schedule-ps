-- Create product_suppliers table
CREATE TABLE IF NOT EXISTS public.product_suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    lead_time_days INTEGER NOT NULL,
    minimum_order_quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    is_preferred BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Ensure a vendor can only be added once per product
    UNIQUE(product_id, vendor_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_product_suppliers_product_id ON public.product_suppliers(product_id);
CREATE INDEX IF NOT EXISTS idx_product_suppliers_vendor_id ON public.product_suppliers(vendor_id);

-- Enable RLS
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sellers can view product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Sellers can insert product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Sellers can update product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Sellers can delete product suppliers" ON public.product_suppliers;

-- Create RLS policies
-- Sellers can view suppliers for their products
CREATE POLICY "Sellers can view product suppliers" ON public.product_suppliers
    FOR SELECT USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can add suppliers to their products
CREATE POLICY "Sellers can insert product suppliers" ON public.product_suppliers
    FOR INSERT WITH CHECK (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can update suppliers for their products
CREATE POLICY "Sellers can update product suppliers" ON public.product_suppliers
    FOR UPDATE USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Sellers can delete suppliers from their products
CREATE POLICY "Sellers can delete product suppliers" ON public.product_suppliers
    FOR DELETE USING (
        product_id IN (
            SELECT id FROM public.products 
            WHERE seller_id IN (
                SELECT id FROM public.sellers 
                WHERE id = auth.uid()
            )
        )
    );

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_product_suppliers_updated_at ON public.product_suppliers;
CREATE TRIGGER update_product_suppliers_updated_at BEFORE UPDATE ON public.product_suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();