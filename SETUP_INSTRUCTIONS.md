# Setup Instructions

## Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" to execute the SQL commands

### Troubleshooting Database Errors

If you get a "Database error saving new user" error:

1. Run the contents of `supabase/schema-fixed.sql` in the SQL Editor
2. This will drop and recreate the trigger with better error handling
3. The application now has fallback logic to create profiles if the trigger fails

If you get "new row violates row-level security policy" error:

1. Run the contents of `supabase/fix-rls-policies.sql` in the SQL Editor
2. This adds INSERT policies that were missing from the original schema
3. The signup now uses an API route with service role key to bypass RLS during user creation

This will create:
- User type enum (seller, vendor)
- Profiles table extending auth.users
- Sellers table for seller-specific data
- Vendors table for vendor-specific data  
- Vendor invitations table
- Row Level Security policies
- Triggers for automatic profile creation

## Authentication Flow

### For Sellers:
1. Navigate to `/signup` to create a seller account
2. Fill in the registration form (only sellers can sign up)
3. Check email for confirmation link
4. After confirming, login at `/login`
5. You'll be redirected to `/seller/dashboard`

### For Vendors:
1. Vendors cannot sign up directly
2. They must be invited by a seller (invitation system coming soon)
3. Once invited, they can login at `/login`
4. They'll be redirected to `/vendor/dashboard`

## Testing the Application

1. The dev server should be running on http://localhost:3000
2. Navigate to the root URL - you'll be redirected to `/login`
3. Create a seller account at `/signup`
4. After email confirmation, login to see the seller dashboard

## Next Steps

The vendor invitation system will allow sellers to:
- Send invitation emails to vendors
- Track invitation status
- Manage their vendors

Vendors will receive a special link to complete their registration.