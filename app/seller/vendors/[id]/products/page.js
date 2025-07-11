import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import SupplierProductsTable from './supplier-products-table'

export default async function SupplierProductsPage({ params }) {
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

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch products that are linked to this supplier
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select(`
      *,
      product_suppliers!inner (
        supplier_id,
        price_per_unit,
        moq,
        lead_time_days
      )
    `)
    .eq('seller_id', user.id)
    .eq('product_suppliers.supplier_id', params.id)
    .order('created_at', { ascending: false })

  if (productsError) {
    console.error('Error fetching supplier products:', productsError)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Products from {vendor.company_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage products supplied by this vendor
        </p>
      </div>
      
      <SupplierProductsTable 
        products={products || []} 
        vendorId={params.id}
      />
    </div>
  )
}