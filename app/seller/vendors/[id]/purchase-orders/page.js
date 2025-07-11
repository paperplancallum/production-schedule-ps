import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PurchaseOrdersTable from './purchase-orders-table'

export default async function PurchaseOrdersPage({ params }) {
  const supabase = await createClient()
  
  // Get vendor details first
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (vendorError || !vendor || vendor.vendor_type !== 'supplier') {
    notFound()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Purchase Orders - {vendor.company_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage purchase orders for this supplier
        </p>
      </div>
      
      <PurchaseOrdersTable vendorId={params.id} />
    </div>
  )
}