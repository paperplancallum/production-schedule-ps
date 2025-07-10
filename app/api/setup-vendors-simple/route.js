import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // First, check if vendors_simple table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('vendors_simple')
      .select('id')
      .limit(1)

    if (!checkError) {
      return NextResponse.json({ 
        success: true, 
        message: 'vendors_simple table already exists' 
      })
    }

    // Create the vendors_simple table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create a simple vendors table that doesn't require profile connection
        CREATE TABLE IF NOT EXISTS vendors_simple (
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_vendors_simple_seller_id ON vendors_simple(seller_id);
        CREATE INDEX IF NOT EXISTS idx_vendors_simple_vendor_status ON vendors_simple(vendor_status);
        CREATE INDEX IF NOT EXISTS idx_vendors_simple_vendor_type ON vendors_simple(vendor_type);

        -- Enable RLS
        ALTER TABLE vendors_simple ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Sellers can view their vendors" ON vendors_simple
          FOR SELECT
          USING (seller_id = auth.uid());

        CREATE POLICY "Sellers can insert vendors" ON vendors_simple
          FOR INSERT
          WITH CHECK (seller_id = auth.uid());

        CREATE POLICY "Sellers can update their vendors" ON vendors_simple
          FOR UPDATE
          USING (seller_id = auth.uid())
          WITH CHECK (seller_id = auth.uid());

        CREATE POLICY "Sellers can delete their vendors" ON vendors_simple
          FOR DELETE
          USING (seller_id = auth.uid());
      `
    })

    if (createTableError) {
      // If exec_sql doesn't exist, try a different approach
      // Just return success and let user create table manually
      return NextResponse.json({ 
        success: false, 
        message: 'Please create the vendors_simple table manually in Supabase dashboard',
        sql: `
-- Run this SQL in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS vendors_simple (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendors_simple_seller_id ON vendors_simple(seller_id);
CREATE INDEX IF NOT EXISTS idx_vendors_simple_vendor_status ON vendors_simple(vendor_status);
CREATE INDEX IF NOT EXISTS idx_vendors_simple_vendor_type ON vendors_simple(vendor_type);

-- Enable RLS
ALTER TABLE vendors_simple ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their vendors" ON vendors_simple
  FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert vendors" ON vendors_simple
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their vendors" ON vendors_simple
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their vendors" ON vendors_simple
  FOR DELETE
  USING (seller_id = auth.uid());
        `
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'vendors_simple table created successfully' 
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}