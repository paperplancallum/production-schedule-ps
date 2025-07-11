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

  // Since vendors can't read product_suppliers due to RLS, we need a different approach
  // For now, we'll show a message that products need to be properly assigned
  let products = []
  let rlsError = null
  
  // Try the query anyway to confirm the RLS issue
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_suppliers!inner (
        id,
        vendor_id,
        is_primary,
        lead_time_days,
        moq,
        supplier_price_tiers (
          id,
          minimum_order_quantity,
          unit_price,
          is_default
        )
      )
    `)
    .eq('product_suppliers.vendor_id', vendor.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching vendor products:', error)
    rlsError = error
  } else {
    products = data || []
  }

  // Additional debug: Check if there are any product_suppliers entries for this vendor
  const { data: supplierEntries, error: supplierError } = await supabase
    .from('product_suppliers')
    .select('*')
    .eq('vendor_id', vendor.id)
    .limit(5)
  
  console.log('Product supplier entries for vendor:', supplierEntries)
  console.log('Product supplier query error:', supplierError)
  
  // If we can read product_suppliers now, let's check the products table permissions
  if (supplierEntries && supplierEntries.length > 0) {
    console.log('✅ Can read product_suppliers! Found:', supplierEntries.length)
    
    // Try to read products directly
    const productIds = supplierEntries.map(ps => ps.product_id)
    const { data: directProducts, error: directError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
    
    console.log('Direct products query:', { data: directProducts, error: directError })
  }
  
  // Also check without any filters to see if we can access the table at all
  const { data: allSuppliers, error: allError } = await supabase
    .from('product_suppliers')
    .select('vendor_id')
    .limit(10)
  
  console.log('All product suppliers (first 10):', allSuppliers)
  console.log('All suppliers query error:', allError)

  if (error) {
    console.error('Error fetching products:', error)
  }

  // Debug logging
  console.log('=== VENDOR PRODUCTS DEBUG ===')
  console.log('Current user ID:', user.id)
  console.log('Vendor record:', vendor)
  console.log('Vendor ID:', vendor?.id)
  console.log('Vendor user_id:', vendor?.user_id)
  console.log('Auth matches vendor?', vendor?.user_id === user.id)
  console.log('Products found via join query:', products?.length || 0)
  console.log('Main query error:', error?.message)
  
  // Final check - try the simplest possible query
  const { data: testAccess, error: testError } = await supabase
    .from('product_suppliers')
    .select('id, vendor_id')
    .limit(1)
  
  console.log('Can read ANY product_suppliers?', { success: !testError, data: testAccess })

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
        
        {/* Debug info */}
        {products?.length === 0 && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              No products have been assigned to your vendor account yet.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
              Your seller needs to assign products to you through their vendor management panel.
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