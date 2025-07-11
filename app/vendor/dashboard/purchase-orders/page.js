import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PurchaseOrdersTable from './purchase-orders-table'

export default async function VendorPurchaseOrdersPage() {
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

  if (!vendor || vendor.vendor_type !== 'supplier') {
    redirect('/vendor/dashboard')
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-900">
      <nav className="bg-white dark:bg-slate-950 shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Purchase Orders</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Purchase Orders
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Orders from your seller
          </p>
        </div>
        
        <PurchaseOrdersTable vendorId={vendor.id} />
      </main>
    </div>
  )
}