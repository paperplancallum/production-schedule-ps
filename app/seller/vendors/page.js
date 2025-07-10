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

  // Try to fetch from vendors_simple first
  let vendors = []
  let vendorsError = null
  
  // First try vendors_simple
  const { data: vendorsSimple, error: simpleError } = await supabase
    .from('vendors_simple')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  if (!simpleError) {
    vendors = vendorsSimple
  } else {
    // If vendors_simple doesn't exist, try original vendors table
    const { data: vendorsOriginal, error: originalError } = await supabase
      .from('vendors')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
    
    if (!originalError) {
      vendors = vendorsOriginal
    } else {
      vendorsError = simpleError // Use the simple table error as primary
      console.error('Error fetching vendors:', {
        simpleError: simpleError?.message,
        originalError: originalError?.message,
        hint: 'Table might not exist. Visit /setup-vendors to create it.'
      })
    }
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
        tableName={vendorsError ? null : (vendors === vendorsSimple ? 'vendors_simple' : 'vendors')}
      />
    </div>
  )
}