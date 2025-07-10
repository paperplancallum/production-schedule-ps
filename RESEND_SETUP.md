# Resend Email Setup Guide

## Current Issue
Resend is in test mode and only allows sending emails to the account owner's email address (callum@paperplan.co).

## The Restriction
```
You can only send testing emails to your own email address (callum@paperplan.co). 
To send emails to other recipients, please verify a domain at resend.com/domains
```

## Solutions

### For Production Use
1. Go to https://resend.com/domains
2. Add and verify your domain (e.g., paperplan.co)
3. Update the `RESEND_FROM_EMAIL` environment variable:
   - In `.env.local`: `RESEND_FROM_EMAIL="Production Schedule <noreply@paperplan.co>"`
   - In Vercel: Add the same environment variable in your project settings
4. Emails will then work for all recipients

### For Development/Testing
- Emails will only send to callum@paperplan.co
- Use the "Copy invitation link" feature for other vendors
- The system still updates vendor status correctly

### 2. API Key Issues
Your API key might have restrictions or be invalid.

**To Check:**
1. Visit https://resend.com/api-keys
2. Verify your API key is active
3. Check if there are any restrictions

### 3. Rate Limiting
Free Resend accounts have rate limits.

**Current Limits (Free Tier):**
- 100 emails per day
- 1 email per second

## Temporary Workaround
When email fails, the system now:
1. Still updates the vendor status to "Invited"
2. Shows a warning toast with an option to copy the invitation link
3. You can manually send this link to the vendor


## Alternative Solutions

### Option 1: Use Supabase Auth Email
Instead of Resend, use Supabase's built-in email functionality:
```javascript
// In your invite function
const { error } = await supabase.auth.admin.inviteUserByEmail(vendor.email, {
  data: { 
    vendor_id: vendorId,
    invited_by: currentUserId 
  }
})
```

### Option 2: Use a Different Email Service
- SendGrid
- Mailgun
- AWS SES
- Postmark

### Option 3: Development Mode
For development, you could:
1. Log invitation links to console
2. Show them in a development panel
3. Use a service like Mailtrap for testing

## Debug Information
Check the server logs for detailed error messages when invitation fails. The API now logs:
- Email recipient
- API key status
- Detailed error information