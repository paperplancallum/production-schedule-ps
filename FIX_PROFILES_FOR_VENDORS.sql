-- Fix profiles table access and ensure vendors have profiles

-- First, check if profiles table has RLS enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create comprehensive policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Ensure the profiles table has all necessary columns
-- Note: user_type already exists as an enum, so we skip adding it

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create a function to automatically create profiles on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_type, created_at, updated_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'vendor')::user_type,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    user_type = COALESCE(EXCLUDED.user_type, profiles.user_type),
    updated_at = now();
  
  RETURN new;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to auto-create profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix any existing vendor users that don't have profiles
INSERT INTO profiles (id, email, user_type, created_at, updated_at)
SELECT DISTINCT 
  v.user_id,
  v.email,
  'vendor'::user_type,
  NOW(),
  NOW()
FROM vendors v
WHERE v.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = v.user_id
  )
ON CONFLICT (id) DO UPDATE
SET user_type = 'vendor'::user_type,
    updated_at = NOW();