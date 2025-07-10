-- IMPORTANT: Run this if you get errors with the original schema

-- First, drop existing objects if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS accept_vendor_invitation(UUID, UUID);

-- Recreate the function with better error handling
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

-- Alternative: If the trigger is causing issues, you can handle profile creation in the application
-- Comment out the trigger creation above and use this approach instead