# Resend Email Setup Guide

## Current Issue
The vendor invitation emails are failing to send. The vendor status is being updated correctly, but the email delivery is failing.

## Common Causes & Solutions

### 1. Domain Verification (Most Likely)
Resend requires domain verification to send emails from custom domains. Currently using `onboarding@resend.dev` which should work for testing.

**Solution:**
- Use `onboarding@resend.dev` as the sender (current setup)
- Or verify your own domain in Resend dashboard

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

## Testing Email Preview
Visit `/api/vendors/invite/preview` to see how the invitation email looks.

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