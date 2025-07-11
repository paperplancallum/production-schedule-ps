import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorSidebar from './vendor-sidebar'

export default async function VendorDashboardLayout({ children }) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get vendor details
  const { data: vendor } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <VendorSidebar vendor={vendor} />
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}