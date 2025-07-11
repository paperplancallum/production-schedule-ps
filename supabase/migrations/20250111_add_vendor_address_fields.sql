-- Add address fields to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- Create indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_name ON vendors(vendor_name);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_email ON vendors(vendor_email);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(city);

-- Update any existing records to have contact_person from contact_name if it exists
UPDATE vendors 
SET contact_person = contact_name 
WHERE contact_person IS NULL AND contact_name IS NOT NULL;