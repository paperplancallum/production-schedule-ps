import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { email, password, fullName, companyName } = await request.json()
    
    const supabase = createAdminClient()
    
    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        full_name: fullName,
        user_type: 'seller'
      },
      email_confirm: true // Auto-confirm email for development
    })
    
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }
    
    // Create profile record with admin client (bypasses RLS)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        user_type: 'seller',
        full_name: fullName,
        company_name: companyName
      })
      
    if (profileError) {
      // If profile creation fails, delete the user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 400 })
    }
    
    // Create seller record
    const { error: sellerError } = await supabase
      .from('sellers')
      .insert({ id: authData.user.id })
      
    if (sellerError) {
      // If seller creation fails, delete the user
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: sellerError.message }, { status: 400 })
    }
    
    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}