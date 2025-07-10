-- Complete migration for vendors table and all related schemas

-- First ensure all base tables exist (in case they weren't created)
-- Create user_type enum if not exists
DO $$ BEGIN
    CREATE TYPE user_type AS ENUM ('seller', 'vendor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create profiles table if not exists
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_type user_type NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sellers table if not exists
CREATE TABLE IF NOT EXISTS sellers (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  business_address TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vendors table if not exists
CREATE TABLE IF NOT EXISTS vendors (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  vendor_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add new columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS vendor_name TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS vendor_type TEXT CHECK (vendor_type IN ('warehouse', 'supplier', 'inspection_agent', 'shipping_agent')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create vendor_invitations table if not exists
CREATE TABLE IF NOT EXISTS vendor_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invitation_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL
);

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for sellers" ON sellers;
DROP POLICY IF EXISTS "Sellers can view own data" ON sellers;
DROP POLICY IF EXISTS "Sellers can update own data" ON sellers;
DROP POLICY IF EXISTS "Vendors can view own data" ON vendors;
DROP POLICY IF EXISTS "Sellers can view their vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can update their vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can insert vendors" ON vendors;
DROP POLICY IF EXISTS "Sellers can view own invitations" ON vendor_invitations;
DROP POLICY IF EXISTS "Sellers can create invitations" ON vendor_invitations;

-- RLS Policies for profiles
CREATE POLICY "Enable insert for authenticated users" ON profiles
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for sellers
CREATE POLICY "Enable insert for sellers" ON sellers
  FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Sellers can view own data" ON sellers
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Sellers can update own data" ON sellers
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for vendors
CREATE POLICY "Vendors can view own data" ON vendors
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Sellers can view their vendors" ON vendors
  FOR SELECT 
  USING (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update their vendors" ON vendors
  FOR UPDATE 
  USING (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  );

CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  );

-- RLS Policies for vendor_invitations
CREATE POLICY "Sellers can view own invitations" ON vendor_invitations
  FOR SELECT 
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can create invitations" ON vendor_invitations
  FOR INSERT 
  WITH CHECK (seller_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vendors_seller_id ON vendors(seller_id);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendor_invitations_seller_id ON vendor_invitations(seller_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invitations_status ON vendor_invitations(status);

-- Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles table
  INSERT INTO profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'seller'::user_type),
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- If user is a seller, create seller record
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'seller') = 'seller' THEN
    INSERT INTO sellers (id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();