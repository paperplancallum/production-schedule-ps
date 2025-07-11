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

  // Fetch order items with related data
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select(`
      id,
      quantity,
      unit_price,
      line_total,
      notes,
      product_id,
      product_supplier_id,
      price_tier_id,
      product:products(
        id,
        product_name,
        sku,
        description,
        unit_of_measure
      ),
      product_supplier:product_suppliers(
        id,
        lead_time_days,
        moq
      ),
      price_tier:supplier_price_tiers(
        id,
        minimum_order_quantity,
        unit_price
      )
    `)
    .eq('purchase_order_id', order.id)

  // Fetch status history
  const { data: statusHistory } = await supabase
    .from('purchase_order_status_history')
    .select('id, from_status, to_status, notes, created_at, changed_by')
    .eq('purchase_order_id', order.id)
    .order('created_at', { ascending: false })

  // Combine all data
  const orderWithDetails = {
    ...order,
    vendor,
    seller: seller || {},
    items: items || [],
    status_history: statusHistory || []
  }

  return <VendorPurchaseOrderDetail order={orderWithDetails} />
}