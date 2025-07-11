import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import VendorPurchaseOrderDetail from './vendor-purchase-order-detail'

export default async function VendorPurchaseOrderPage({ params }) {
  const supabase = await createClient()
  const { id } = await params
  
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

  // Get purchase order
  const { data: order, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .eq('supplier_id', vendor.id)
    .neq('status', 'draft')  // Vendors cannot see draft POs
    .single()

  if (error || !order) {
    notFound()
  }

  // Fetch seller details
  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', order.seller_id)
    .single()

  // First, fetch order items
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', order.id)

  // For existing purchase orders, we need to get product details
  // Even if products aren't assigned to the vendor, they should see products in their POs
  let itemsWithDetails = items || []
  
  if (items && items.length > 0) {
    // Get all product supplier IDs
    const productSupplierIds = items
      .map(item => item.product_supplier_id)
      .filter(Boolean)
    
    if (productSupplierIds.length > 0) {
      // Fetch product suppliers with products
      const { data: productSuppliers } = await supabase
        .from('product_suppliers')
        .select(`
          id,
          lead_time_days,
          products (
            id,
            product_name,
            sku,
            description,
            unit_of_measure
          )
        `)
        .in('id', productSupplierIds)
      
      if (productSuppliers) {
        const suppliersMap = productSuppliers.reduce((acc, ps) => {
          acc[ps.id] = ps
          return acc
        }, {})
        
        itemsWithDetails = items.map(item => ({
          ...item,
          product: suppliersMap[item.product_supplier_id]?.products || null,
          lead_time_days: suppliersMap[item.product_supplier_id]?.lead_time_days || 0
        }))
      }
    }
    
    // If we still don't have products, try direct product fetch as last resort
    const itemsWithoutProducts = itemsWithDetails.filter(item => !item.product && item.product_id)
    if (itemsWithoutProducts.length > 0) {
      const productIds = [...new Set(itemsWithoutProducts.map(item => item.product_id))]
      
      const { data: products } = await supabase
        .from('products')
        .select('id, product_name, sku, description, unit_of_measure')
        .in('id', productIds)
      
      if (products) {
        const productsMap = products.reduce((acc, product) => {
          acc[product.id] = product
          return acc
        }, {})
        
        itemsWithDetails = itemsWithDetails.map(item => ({
          ...item,
          product: item.product || productsMap[item.product_id] || null
        }))
      }
    }
  }

  // Fetch status history
  const { data: statusHistory } = await supabase
    .from('purchase_order_status_history')
    .select('id, from_status, to_status, notes, created_at, changed_by')
    .eq('purchase_order_id', order.id)
    .order('created_at', { ascending: false })

  // Fetch user details for status changes
  const statusHistoryWithUsers = await Promise.all(
    (statusHistory || []).map(async (history) => {
      if (!history.changed_by) return history
      
      // Try to find if it's a seller
      const { data: seller } = await supabase
        .from('sellers')
        .select('id, company_name')
        .eq('id', history.changed_by)
        .single()
      
      if (seller) {
        return { ...history, changed_by_user: { type: 'seller', name: seller.company_name } }
      }
      
      // Try to find if it's a vendor
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('user_id', history.changed_by)
        .single()
      
      if (vendor) {
        return { ...history, changed_by_user: { type: 'vendor', name: vendor.vendor_name } }
      }
      
      return history
    })
  )

  // Combine all data
  const orderWithDetails = {
    ...order,
    vendor,
    seller: seller || {},
    items: itemsWithDetails || [],
    status_history: statusHistoryWithUsers || []
  }

  return <VendorPurchaseOrderDetail order={orderWithDetails} />
}