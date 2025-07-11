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

  // Fetch order items with product details through product_suppliers relationship
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select(`
      *,
      product_supplier:product_suppliers!product_supplier_id (
        id,
        product:products (
          id,
          product_name,
          sku,
          description,
          unit_of_measure
        )
      )
    `)
    .eq('purchase_order_id', order.id)
  
  // Map the nested structure to match expected format
  const itemsWithDetails = (items || []).map(item => ({
    ...item,
    product: item.product_supplier?.product || null,
    product_supplier: item.product_supplier ? {
      ...item.product_supplier,
      product: undefined
    } : null
  }))

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