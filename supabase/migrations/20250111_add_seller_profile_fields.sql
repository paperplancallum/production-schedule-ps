-- Add profile fields to sellers table
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_email TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_phone TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Create indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_sellers_company_name ON sellers(company_name);
CREATE INDEX IF NOT EXISTS idx_sellers_business_email ON sellers(business_email);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_sellers_updated_at ON sellers;
CREATE TRIGGER update_sellers_updated_at
    BEFORE UPDATE ON sellers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();