-- IMPORTANT: Run this SQL in your Supabase SQL Editor to consolidate vendor tables
-- This will drop the old vendors table and rename vendors_simple to vendors

-- Step 1: Drop the old vendors table (with CASCADE to handle any dependencies)
DROP TABLE IF EXISTS vendors CASCADE;

-- Step 2: Check if vendors_simple exists and rename it
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'vendors_simple') THEN
    -- Rename vendors_simple to vendors
    ALTER TABLE vendors_simple RENAME TO vendors;
    
    -- Update indexes to reflect the new table name
    ALTER INDEX IF EXISTS idx_vendors_simple_seller_id RENAME TO idx_vendors_seller_id;
    ALTER INDEX IF EXISTS idx_vendors_simple_vendor_status RENAME TO idx_vendors_vendor_status;
    ALTER INDEX IF EXISTS idx_vendors_simple_vendor_type RENAME TO idx_vendors_vendor_type;
    
    RAISE NOTICE 'Successfully renamed vendors_simple to vendors';
  ELSE
    -- If vendors_simple doesn't exist, create vendors table from scratch
    CREATE TABLE vendors (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      vendor_name TEXT NOT NULL,
      email TEXT NOT NULL,
      country TEXT,
      address TEXT,
      contact_name TEXT,
      vendor_type TEXT CHECK (vendor_type IN ('warehouse', 'supplier', 'inspection_agent', 'shipping_agent')),
      vendor_status TEXT DEFAULT 'draft' CHECK (vendor_status IN ('draft', 'invited', 'accepted', 'archived')),
      vendor_code TEXT UNIQUE DEFAULT 'V' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
      invitation_token UUID,
      invitation_sent_at TIMESTAMP WITH TIME ZONE,
      accepted_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Create indexes
    CREATE INDEX idx_vendors_seller_id ON vendors(seller_id);
    CREATE INDEX idx_vendors_vendor_status ON vendors(vendor_status);
    CREATE INDEX idx_vendors_vendor_type ON vendors(vendor_type);
    CREATE INDEX idx_vendors_invitation_token ON vendors(invitation_token);
    
    -- Add unique constraint for invitation token
    ALTER TABLE vendors ADD CONSTRAINT vendors_invitation_token_unique UNIQUE (invitation_token);

    -- Enable RLS
    ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Sellers can view their vendors" ON vendors
      FOR SELECT
      USING (seller_id = auth.uid());

    CREATE POLICY "Sellers can insert vendors" ON vendors
      FOR INSERT
      WITH CHECK (seller_id = auth.uid());

    CREATE POLICY "Sellers can update their vendors" ON vendors
      FOR UPDATE
      USING (seller_id = auth.uid())
      WITH CHECK (seller_id = auth.uid());

    CREATE POLICY "Sellers can delete their vendors" ON vendors
      FOR DELETE
      USING (seller_id = auth.uid());
    
    RAISE NOTICE 'Created new vendors table from scratch';
  END IF;
END $$;