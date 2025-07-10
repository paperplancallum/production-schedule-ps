import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function DELETE(request, { params }) {
  try {
    const { id } = params

    if (!id) {
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

    // Delete the vendor
    const { error } = await supabase
      .from('vendors')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting vendor:', error)
      return NextResponse.json({ error: 'Failed to delete vendor' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Vendor deleted successfully'
    })

  } catch (error) {
    console.error('Delete vendor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}