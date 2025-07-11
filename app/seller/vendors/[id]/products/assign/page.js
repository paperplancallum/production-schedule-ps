import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import AssignProductsForm from './assign-products-form'

export default async function AssignProductsPage({ params }) {
  const supabase = await createClient()
  
  // Get vendor details
  const { data: vendor, error: vendorError } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (vendorError || !vendor || vendor.vendor_type !== 'supplier') {
    notFound()
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get all seller's products
  const { data: allProducts, error: productsError } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', user.id)
    .eq('status', 'active')
    .order('name', { ascending: true })

  // Get currently assigned products
  const { data: assignedProducts, error: assignedError } = await supabase
    .from('product_suppliers')
    .select('product_id')
    .eq('vendor_id', params.id)

  const assignedProductIds = assignedProducts?.map(ap => ap.product_id) || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Assign Products to {vendor.vendor_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Select products that this supplier can provide
        </p>
      </div>
      
      <AssignProductsForm 
        vendorId={params.id}
        vendorName={vendor.vendor_name}
        products={allProducts || []}
        assignedProductIds={assignedProductIds}
      />
    </div>
  )
}