-- Enable RLS on sellers table if not already enabled
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Users can view own seller profile" ON sellers;
DROP POLICY IF EXISTS "Users can update own seller profile" ON sellers;
DROP POLICY IF EXISTS "Users can insert own seller profile" ON sellers;

-- Create policy for viewing own seller profile
CREATE POLICY "Users can view own seller profile" ON sellers
    FOR SELECT USING (auth.uid() = id);

-- Create policy for updating own seller profile
CREATE POLICY "Users can update own seller profile" ON sellers
    FOR UPDATE USING (auth.uid() = id);

-- Create policy for inserting own seller profile
CREATE POLICY "Users can insert own seller profile" ON sellers
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON sellers TO authenticated;

-- Ensure all columns exist with proper types
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'full_name') THEN
        ALTER TABLE sellers ADD COLUMN full_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'company_name') THEN
        ALTER TABLE sellers ADD COLUMN company_name TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'address_line1') THEN
        ALTER TABLE sellers ADD COLUMN address_line1 TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'address_line2') THEN
        ALTER TABLE sellers ADD COLUMN address_line2 TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'city') THEN
        ALTER TABLE sellers ADD COLUMN city TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'state') THEN
        ALTER TABLE sellers ADD COLUMN state TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'zip_code') THEN
        ALTER TABLE sellers ADD COLUMN zip_code TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'country') THEN
        ALTER TABLE sellers ADD COLUMN country TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'business_email') THEN
        ALTER TABLE sellers ADD COLUMN business_email TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'business_phone') THEN
        ALTER TABLE sellers ADD COLUMN business_phone TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'tax_id') THEN
        ALTER TABLE sellers ADD COLUMN tax_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'website') THEN
        ALTER TABLE sellers ADD COLUMN website TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sellers' AND column_name = 'updated_at') THEN
        ALTER TABLE sellers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;