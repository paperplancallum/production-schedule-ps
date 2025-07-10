# Supabase Configuration Settings

## Disable Email Confirmation (Development)

To disable email confirmation requirement:

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Find "Confirm email" setting
4. Toggle it OFF (disable)
5. Save changes

This will allow users to login immediately after signup without email confirmation.

## Manual Email Confirmation (If needed)

If you want to keep email confirmation enabled but need to manually confirm users:

1. Go to **SQL Editor** in Supabase Dashboard
2. Run the contents of `supabase/confirm-users.sql`
3. This will confirm all unconfirmed users

## Alternative: Use Supabase Dashboard

1. Go to **Authentication** → **Users**
2. Find your user
3. Click on the user
4. Look for "Email Confirmed At" field
5. If it's empty, you can manually confirm the user

## For Production

For production, you should:
1. Keep email confirmation enabled
2. Configure proper email templates
3. Set up a custom SMTP server for reliable email delivery