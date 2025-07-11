-- Create product_suppliers table to link products with supplier vendors
CREATE TABLE IF NOT EXISTS product_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  price_per_unit DECIMAL(10, 2),
  moq INTEGER DEFAULT 1, -- Minimum Order Quantity
  lead_time_days INTEGER DEFAULT 0,
  is_preferred BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique product-supplier combination
  UNIQUE(product_id, vendor_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_product_suppliers_product_id ON product_suppliers(product_id);
CREATE INDEX idx_product_suppliers_vendor_id ON product_suppliers(vendor_id);

-- Enable RLS
ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Sellers can view and manage product-supplier relationships for their products
CREATE POLICY "Sellers can view product suppliers" ON product_suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can insert product suppliers" ON product_suppliers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update product suppliers" ON product_suppliers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete product suppliers" ON product_suppliers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_suppliers.product_id
      AND p.seller_id = auth.uid()
    )
  );

-- Vendors can view product-supplier relationships where they are the supplier
CREATE POLICY "Vendors can view their product relationships" ON product_suppliers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = product_suppliers.vendor_id
      AND v.user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();