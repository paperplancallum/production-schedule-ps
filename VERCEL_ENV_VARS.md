# Vercel Environment Variables Setup

Copy and paste these into your Vercel project settings:

## 1. Go to Vercel Dashboard
https://vercel.com/paperplancallums-projects/ps/settings/environment-variables

## 2. Add these variables:

### NEXT_PUBLIC_APP_URL
**Value:** `https://ps.vercel.app` (or your custom domain)
**Note:** Update this with your actual production URL

### NEXT_PUBLIC_SUPABASE_URL
**Value:** `https://umpyksvodclguitcwcmv.supabase.co`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
**Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcHlrc3ZvZGNsZ3VpdGN3Y212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxMTM5ODksImV4cCI6MjA2NzY4OTk4OX0.8s8yOr99SbYgSGeUoZj0bTlwzKQR6nXPdXVcqFzdUBU`

### SUPABASE_SERVICE_ROLE_KEY
**Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtcHlrc3ZvZGNsZ3VpdGN3Y212Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjExMzk4OSwiZXhwIjoyMDY3Njg5OTg5fQ.WYq0T_09sSDkse-rPSHNOCyEEiLmLvNxMYiFqfoaj9g`

### RESEND_API_KEY
**Value:** `re_YyvTMsix_EJrBFH8JueWJSTihzu3bPtqo`

### RESEND_FROM_EMAIL
**Value:** `noreply@paperplan.co`

## 3. Click "Save" for each variable

## 4. Redeploy your application
The environment variables will be available after the next deployment.