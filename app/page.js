import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Get user profile to determine redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .single()

    if (profile?.user_type === 'seller') {
      redirect('/seller/dashboard')
    } else if (profile?.user_type === 'vendor') {
      redirect('/vendor/dashboard')
    }
  }

  // If not authenticated, redirect to login
  redirect('/login')
}