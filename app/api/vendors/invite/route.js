import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { vendorId } = await request.json()

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 })
    }

    // Use service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Get seller details
    const { data: seller, error: sellerError } = await supabase
      .from('sellers')
      .select('company_name')
      .eq('user_id', vendor.seller_id)
      .single()

    const sellerName = seller?.company_name || 'Your partner'

    // Generate a unique invitation token
    const invitationToken = crypto.randomUUID()
    
    // Store the invitation token in the vendor record
    const { error: updateError } = await supabase
      .from('vendors')
      .update({ 
        vendor_status: 'invited',
        invitation_token: invitationToken,
        invitation_sent_at: new Date().toISOString()
      })
      .eq('id', vendorId)

    if (updateError) {
      console.error('Error updating vendor:', updateError)
      return NextResponse.json({ error: 'Failed to update vendor status' }, { status: 500 })
    }

    // Send invitation email
    const invitationUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-app.com'}/vendor-signup?token=${invitationToken}`
    
    console.log('Attempting to send email to:', vendor.email)
    console.log('Using Resend API key:', process.env.RESEND_API_KEY ? 'Key is set' : 'Key is missing')
    
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Production Schedule <onboarding@resend.dev>',
        to: vendor.email,
        subject: `${sellerName} invites you to join their vendor network`,
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>You're invited to join ${sellerName}'s vendor network</h2>
          <p>Hello ${vendor.contact_name || 'there'},</p>
          <p>${sellerName} has invited you to join their vendor network as a ${vendor.vendor_type.replace('_', ' ')}.</p>
          <p>Click the link below to create your account and get started:</p>
          <p style="margin: 30px 0;">
            <a href="${invitationUrl}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </p>
          <p>This invitation link will expire in 7 days.</p>
          <p>Best regards,<br>${sellerName}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `
      })

      if (emailError) {
        throw emailError
      }

      console.log('Email sent successfully:', emailData)
    } catch (emailError) {
      console.error('Error sending email:', {
        error: emailError,
        message: emailError?.message,
        name: emailError?.name,
        statusCode: emailError?.statusCode
      })
      
      // Common Resend errors
      let errorDetails = 'Email failed to send'
      if (emailError?.message?.includes('domain')) {
        errorDetails = 'Email domain not verified with Resend'
      } else if (emailError?.message?.includes('API')) {
        errorDetails = 'Invalid Resend API key'
      } else if (emailError?.statusCode === 401) {
        errorDetails = 'Resend authentication failed - check API key'
      }
      
      // Even if email fails, we've updated the status
      return NextResponse.json({ 
        success: true, 
        warning: `Status updated but email failed: ${errorDetails}`,
        vendor_status: 'invited',
        emailError: emailError?.message,
        invitationUrl: invitationUrl, // Include the URL so user can copy it manually
        vendorEmail: vendor.email
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      vendor_status: 'invited'
    })

  } catch (error) {
    console.error('Invite vendor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}