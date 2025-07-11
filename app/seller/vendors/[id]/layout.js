import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VendorSidebar from './vendor-sidebar'

export default async function VendorDetailLayout({ children, params }) {
  const supabase = await createClient()
  
  // Fetch vendor details
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !vendor) {
    notFound()
  }

  return (
    <div className="flex min-h-screen">
      <VendorSidebar vendor={vendor} />
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  )
}