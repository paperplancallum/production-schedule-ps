# Running Database Migrations

Since we couldn't connect via Supabase CLI due to authentication, please run the migration manually:

## Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of: `supabase/migrations/20240110_update_vendors_complete.sql`
5. Click **Run**

This migration will:
- Ensure all tables exist (profiles, sellers, vendors, vendor_invitations)
- Add new columns to the vendors table:
  - vendor_name
  - email
  - country
  - address
  - contact_name
  - vendor_type (with proper enum values)
- Set up all RLS policies
- Create indexes for performance
- Handle the trigger for new user creation

## Option 2: Using Supabase CLI (if you have database password)

```bash
cd /Users/callummundine/Downloads/Production\ Schedule/ps
supabase db push --db-url "postgresql://postgres:[YOUR-DATABASE-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

Replace [YOUR-DATABASE-PASSWORD] with your actual database password from Supabase dashboard.

## Verifying the Migration

After running the migration, you can verify it worked by running this query:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vendors'
ORDER BY ordinal_position;
```

You should see all the new columns including vendor_name, email, country, address, contact_name, and vendor_type.