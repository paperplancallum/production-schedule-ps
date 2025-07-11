import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VendorProductsTable from './vendor-products-table'

export default async function VendorProductsPage() {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get vendor details
  const { data: vendor } = await supabase
    .from('vendors')
    .select('*, seller_id')
    .eq('user_id', user.id)
    .single()

  if (!vendor || vendor.vendor_type !== 'supplier') {
    redirect('/vendor/dashboard')
  }

  // First try to fetch with product_suppliers join
  let { data: products, error } = await supabase
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
    .eq('seller_id', vendor.seller_id)
    .eq('product_suppliers.supplier_id', vendor.id)
    .order('created_at', { ascending: false })

  // If product_suppliers table doesn't exist, fetch products without join
  if (error && error.message?.includes('product_suppliers')) {
    console.log('product_suppliers table not found, fetching products without supplier info')
    const result = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', vendor.seller_id)
      .order('created_at', { ascending: false })
    
    products = result.data
    error = result.error
  }

  if (error) {
    console.error('Error fetching products:', error)
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-900">
      <nav className="bg-white dark:bg-slate-950 shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Products</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Your Products
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Products you supply to your seller
          </p>
        </div>
        
        {error && error.message?.includes('product_suppliers') && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              The product suppliers relationship table is not set up yet. 
              Showing all products for now.
            </p>
          </div>
        )}
        
        <VendorProductsTable 
          products={products || []} 
          vendorId={vendor.id}
        />
      </main>
    </div>
  )
}