import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') || 'sample-token'
  const vendorName = searchParams.get('vendor') || 'John Doe'
  const sellerName = searchParams.get('seller') || 'ACME Corp'
  const vendorType = searchParams.get('type') || 'supplier'
  
  const invitationUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-app.com'}/vendor-signup?token=${token}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Vendor Invitation</title>
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-bottom: 20px;">You're invited to join ${sellerName}'s vendor network</h2>
        <p style="color: #666; line-height: 1.6;">Hello ${vendorName},</p>
        <p style="color: #666; line-height: 1.6;">${sellerName} has invited you to join their vendor network as a ${vendorType.replace('_', ' ')}.</p>
        <p style="color: #666; line-height: 1.6;">Click the link below to create your account and get started:</p>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${invitationUrl}" style="background-color: #0070f3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: 500;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">This invitation link will expire in 7 days.</p>
        <p style="color: #666; line-height: 1.6;">Best regards,<br>${sellerName}</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
        <div style="margin-top: 30px; padding: 20px; background-color: #f0f0f0; border-radius: 5px;">
          <p style="color: #666; font-size: 14px; margin: 0 0 10px 0;"><strong>Debug Info (Development Only):</strong></p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Invitation URL: <code style="background-color: #e0e0e0; padding: 2px 5px; border-radius: 3px;">${invitationUrl}</code></p>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Token: <code style="background-color: #e0e0e0; padding: 2px 5px; border-radius: 3px;">${token}</code></p>
        </div>
      </div>
    </body>
    </html>
  `
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}