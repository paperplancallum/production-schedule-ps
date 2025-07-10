-- Create products table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2),
    cost DECIMAL(10, 2),
    stock_quantity INTEGER DEFAULT 0,
    unit_of_measure VARCHAR(50),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX idx_products_seller_id ON public.products(seller_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_sku ON public.products(sku);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Sellers can view their own products
CREATE POLICY "Sellers can view own products" ON public.products
    FOR SELECT USING (
        seller_id IN (
            SELECT id FROM public.sellers 
            WHERE id = auth.uid()
        )
    );

-- Sellers can insert their own products
CREATE POLICY "Sellers can insert own products" ON public.products
    FOR INSERT WITH CHECK (
        seller_id IN (
            SELECT id FROM public.sellers 
            WHERE id = auth.uid()
        )
    );

-- Sellers can update their own products
CREATE POLICY "Sellers can update own products" ON public.products
    FOR UPDATE USING (
        seller_id IN (
            SELECT id FROM public.sellers 
            WHERE id = auth.uid()
        )
    );

-- Sellers can delete their own products
CREATE POLICY "Sellers can delete own products" ON public.products
    FOR DELETE USING (
        seller_id IN (
            SELECT id FROM public.sellers 
            WHERE id = auth.uid()
        )
    );

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();