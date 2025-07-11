#!/bin/bash

# Script to push database migrations with password
# The password is stored in .env.supabase

# Load the password from .env.supabase
source .env.supabase

# Push the migrations
echo "$SUPABASE_DB_PASSWORD" | supabase db push