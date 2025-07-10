-- Add new columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS vendor_type TEXT CHECK (vendor_type IN ('warehouse', 'supplier', 'inspection_agent', 'shipping_agent'));

-- Add updated_at column
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create an index on vendor_type for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);

-- Update RLS policies to allow sellers to update their vendors
CREATE POLICY "Sellers can update their vendors" ON vendors
  FOR UPDATE USING (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  );