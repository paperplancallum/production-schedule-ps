-- Run this SQL in your Supabase dashboard SQL editor
-- Go to: https://supabase.com/dashboard/project/[YOUR_PROJECT_ID]/sql/new

-- Create supplier_price_tiers table
CREATE TABLE IF NOT EXISTS public.supplier_price_tiers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_supplier_id UUID NOT NULL REFERENCES public.product_suppliers(id) ON DELETE CASCADE,
    minimum_order_quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add is_default column if table already exists but column doesn't
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'supplier_price_tiers' 
                   AND column_name = 'is_default') THEN
        ALTER TABLE public.supplier_price_tiers ADD COLUMN is_default BOOLEAN DEFAULT false;
    END IF;
END $$;

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
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_supplier_price_tiers_updated_at ON public.supplier_price_tiers;
CREATE TRIGGER update_supplier_price_tiers_updated_at BEFORE UPDATE ON public.supplier_price_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data from product_suppliers to price tiers
-- Each supplier's current MOQ and price becomes their first tier
INSERT INTO public.supplier_price_tiers (product_supplier_id, minimum_order_quantity, unit_price)
SELECT id, minimum_order_quantity, unit_price
FROM public.product_suppliers
WHERE minimum_order_quantity IS NOT NULL 
  AND unit_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.supplier_price_tiers 
    WHERE product_supplier_id = public.product_suppliers.id
);

-- Add is_primary column to product_suppliers table
ALTER TABLE public.product_suppliers ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create a function to ensure only one primary supplier per product
CREATE OR REPLACE FUNCTION ensure_single_primary_supplier()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this supplier as primary
  IF NEW.is_primary = true THEN
    -- Set all other suppliers for this product to non-primary
    UPDATE public.product_suppliers
    SET is_primary = false
    WHERE product_id = NEW.product_id
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single primary supplier
DROP TRIGGER IF EXISTS ensure_single_primary_supplier_trigger ON public.product_suppliers;
CREATE TRIGGER ensure_single_primary_supplier_trigger
  BEFORE INSERT OR UPDATE ON public.product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_supplier();