-- Run this in your Supabase SQL editor to create the inspections table

-- Create inspections table
CREATE TABLE IF NOT EXISTS inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_number TEXT UNIQUE NOT NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  inspection_agent_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  inspection_type TEXT NOT NULL DEFAULT 'post_production' CHECK (inspection_type IN ('post_production')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
  scheduled_date DATE,
  actual_date DATE,
  report_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_inspections_seller_id ON inspections(seller_id);
CREATE INDEX IF NOT EXISTS idx_inspections_purchase_order_id ON inspections(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_scheduled_date ON inspections(scheduled_date);

-- Create function to generate inspection number
CREATE OR REPLACE FUNCTION generate_inspection_number()
RETURNS TRIGGER AS $$
DECLARE
  new_number TEXT;
  sequence_number INTEGER;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(inspection_number FROM 'INS-(\d+)$') 
      AS INTEGER
    )
  ), 1000) + 1
  INTO sequence_number
  FROM inspections
  WHERE inspection_number LIKE 'INS-%';
  
  -- Generate the inspection number
  new_number := 'INS-' || sequence_number::TEXT;
  
  NEW.inspection_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate inspection number
DROP TRIGGER IF EXISTS set_inspection_number ON inspections;
CREATE TRIGGER set_inspection_number
  BEFORE INSERT ON inspections
  FOR EACH ROW
  WHEN (NEW.inspection_number IS NULL)
  EXECUTE FUNCTION generate_inspection_number();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_inspection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_inspections_updated_at ON inspections;
CREATE TRIGGER update_inspections_updated_at
  BEFORE UPDATE ON inspections
  FOR EACH ROW
  EXECUTE FUNCTION update_inspection_updated_at();

-- Row Level Security
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Sellers can view own inspections" ON inspections;
DROP POLICY IF EXISTS "Sellers can create inspections" ON inspections;
DROP POLICY IF EXISTS "Sellers can update own inspections" ON inspections;
DROP POLICY IF EXISTS "Sellers can delete own inspections" ON inspections;
DROP POLICY IF EXISTS "Inspection agents can view assigned inspections" ON inspections;
DROP POLICY IF EXISTS "Inspection agents can update assigned inspections" ON inspections;

-- Policy: Sellers can view their own inspections
CREATE POLICY "Sellers can view own inspections" ON inspections
  FOR SELECT
  USING (auth.uid() = seller_id);

-- Policy: Sellers can create inspections
CREATE POLICY "Sellers can create inspections" ON inspections
  FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Policy: Sellers can update their own inspections
CREATE POLICY "Sellers can update own inspections" ON inspections
  FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Policy: Sellers can delete their own inspections
CREATE POLICY "Sellers can delete own inspections" ON inspections
  FOR DELETE
  USING (auth.uid() = seller_id);

-- Policy: Inspection agents can view inspections assigned to them
CREATE POLICY "Inspection agents can view assigned inspections" ON inspections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = inspections.inspection_agent_id
      AND vendors.user_id = auth.uid()
    )
  );

-- Policy: Inspection agents can update inspections assigned to them
CREATE POLICY "Inspection agents can update assigned inspections" ON inspections
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = inspections.inspection_agent_id
      AND vendors.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vendors
      WHERE vendors.id = inspections.inspection_agent_id
      AND vendors.user_id = auth.uid()
    )
  );