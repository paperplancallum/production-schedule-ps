-- Fix RLS policies for profiles table

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies that allow inserts
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

-- Also fix policies for sellers table
DROP POLICY IF EXISTS "Sellers can view own data" ON sellers;
DROP POLICY IF EXISTS "Sellers can update own data" ON sellers;

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

-- Alternative: If you're still having issues, you can temporarily disable RLS for testing
-- WARNING: Only do this for testing, re-enable for production!
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;