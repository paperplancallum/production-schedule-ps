#!/bin/bash

echo "Setting up Vercel environment variables..."

# Get the production URL
PROD_URL=$(vercel ls --yes 2>/dev/null | grep -E "ps-.*\.vercel\.app" | head -1)

if [ -z "$PROD_URL" ]; then
    echo "Could not determine production URL. Please enter it manually:"
    read -p "Production URL (e.g., https://ps.vercel.app): " PROD_URL
fi

echo "Using production URL: $PROD_URL"

# Read values from .env.local
if [ -f .env.local ]; then
    echo "Reading values from .env.local..."
    source .env.local
else
    echo "Warning: .env.local not found"
fi

# Set environment variables
echo "Setting NEXT_PUBLIC_APP_URL..."
echo "$PROD_URL" | vercel env add NEXT_PUBLIC_APP_URL production

echo "Setting NEXT_PUBLIC_SUPABASE_URL..."
echo "$NEXT_PUBLIC_SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

echo "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY..."
echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
echo "$SUPABASE_SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

echo "Setting RESEND_API_KEY..."
echo "$RESEND_API_KEY" | vercel env add RESEND_API_KEY production

echo "Setting RESEND_FROM_EMAIL..."
echo "$RESEND_FROM_EMAIL" | vercel env add RESEND_FROM_EMAIL production

echo "Done! Environment variables have been set."
echo "You may need to redeploy for changes to take effect."