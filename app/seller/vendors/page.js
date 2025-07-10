import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorTable from './vendor-table'

export default async function VendorsPage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch vendors
  const { data: vendors, error: vendorsError } = await supabase
    .from('vendors')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  if (vendorsError) {
    console.error('Error fetching vendors:', {
      error: vendorsError,
      message: vendorsError?.message,
      details: vendorsError?.details,
      hint: vendorsError?.hint,
      code: vendorsError?.code
    })
  }

  return (
    <div className="p-6">
      {vendorsError && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Unable to load vendors. The vendors table might not be set up yet.{' '}
            <a href="/setup-vendors" className="underline font-medium">
              Click here to set up the vendors table
            </a>
          </p>
        </div>
      )}
      <VendorTable 
        initialVendors={vendors || []} 
        currentUserId={user.id}
      />
    </div>
  )
}