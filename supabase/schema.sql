-- Create user_type enum
CREATE TYPE user_type AS ENUM ('seller', 'vendor');

-- Create profiles table that extends auth.users
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_type user_type NOT NULL,
  full_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sellers table for seller-specific data
CREATE TABLE sellers (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  business_address TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vendors table for vendor-specific data
CREATE TABLE vendors (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  vendor_code TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create vendor_invitations table
CREATE TABLE vendor_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES sellers(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invitation_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc'::text, now()) + interval '7 days') NOT NULL
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for sellers
CREATE POLICY "Sellers can view own data" ON sellers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Sellers can update own data" ON sellers
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for vendors
CREATE POLICY "Vendors can view own data" ON vendors
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Sellers can view their vendors" ON vendors
  FOR SELECT USING (
    seller_id IN (
      SELECT id FROM sellers WHERE id = auth.uid()
    )
  );

-- RLS Policies for vendor_invitations
CREATE POLICY "Sellers can view own invitations" ON vendor_invitations
  FOR SELECT USING (seller_id = auth.uid());

CREATE POLICY "Sellers can create invitations" ON vendor_invitations
  FOR INSERT WITH CHECK (seller_id = auth.uid());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, user_type, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'seller')::user_type,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- If user is a seller, create seller record
  IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'seller') = 'seller' THEN
    INSERT INTO sellers (id) VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to handle vendor invitation acceptance
CREATE OR REPLACE FUNCTION accept_vendor_invitation(invitation_token_input UUID, vendor_user_id UUID)
RETURNS VOID AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Get invitation details
  SELECT * INTO invitation_record
  FROM vendor_invitations
  WHERE invitation_token = invitation_token_input
    AND status = 'pending'
    AND expires_at > NOW();
    
  IF invitation_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Create vendor record
  INSERT INTO vendors (id, seller_id)
  VALUES (vendor_user_id, invitation_record.seller_id);
  
  -- Update invitation status
  UPDATE vendor_invitations
  SET status = 'accepted'
  WHERE id = invitation_record.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;