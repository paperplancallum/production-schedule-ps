import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { token, userId } = await request.json()
    
    if (!token || !userId) {
      return NextResponse.json({ error: 'Token and userId are required' }, { status: 400 })
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

    // Update vendor record
    const { data, error } = await supabase
      .from('vendors')
      .update({
        user_id: userId,
        vendor_status: 'accepted'
      })
      .eq('invitation_token', token)
      .select()
      .single()

    if (error) {
      console.error('Error updating vendor status:', error)
      return NextResponse.json({ 
        error: 'Failed to update vendor status',
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      vendor: data,
      message: 'Vendor status updated successfully'
    })

  } catch (error) {
    console.error('Complete signup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}