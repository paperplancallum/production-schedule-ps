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

  // Since the join query is failing, let's fetch data separately
  let products = []
  let rlsError = null
  
  // First, get all product_suppliers for this vendor
  const { data: productSuppliers, error: psError } = await supabase
    .from('product_suppliers')
    .select(`
      *,
      supplier_price_tiers (
        id,
        minimum_order_quantity,
        unit_price,
        is_default
      )
    `)
    .eq('vendor_id', vendor.id)
  
  console.log('Product suppliers with tiers:', productSuppliers?.length || 0)
  
  if (productSuppliers && productSuppliers.length > 0) {
    // Get unique product IDs
    const productIds = [...new Set(productSuppliers.map(ps => ps.product_id))]
    
    // Try to fetch products one by one to see which ones fail
    const productPromises = productIds.map(async (productId) => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single()
      
      if (error) {
        console.log(`Failed to fetch product ${productId}:`, error.message)
        return null
      }
      return data
    })
    
    const fetchedProducts = await Promise.all(productPromises)
    const validProducts = fetchedProducts.filter(p => p !== null)
    
    console.log(`Successfully fetched ${validProducts.length} out of ${productIds.length} products`)
    
    // Combine products with their supplier info
    products = validProducts.map(product => {
      const supplierData = productSuppliers.filter(ps => ps.product_id === product.id)
      return {
        ...product,
        product_suppliers: supplierData
      }
    })
  }

  if (psError) {
    console.error('Error fetching product suppliers:', psError)
  }

  // Summary
  console.log('=== VENDOR PRODUCTS SUMMARY ===')
  console.log('Vendor:', vendor.vendor_name, vendor.id)
  console.log('Products found:', products.length)
  if (products.length === 0 && productSuppliers && productSuppliers.length > 0) {
    console.log('⚠️ Found product_suppliers but cannot read products table')
    console.log('This indicates an RLS policy issue on the products table')
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
        
        {psError && psError.message?.includes('infinite recursion') && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">
              There is a database policy issue preventing products from being displayed. 
              Please contact your administrator to fix the RLS policies.
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