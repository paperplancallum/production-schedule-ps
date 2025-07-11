import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PurchaseOrderDetail from './purchase-order-detail'

export default async function PurchaseOrderPage({ params }) {
  const supabase = await createClient()
  const { id } = await params
  
  // Get purchase order
  const { data: order, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !order) {
    notFound()
  }

  // Fetch supplier details separately
  const { data: supplier } = await supabase
    .from('vendors')
    .select('id, vendor_name, vendor_type, email, contact_name, country, address')
    .eq('id', order.supplier_id)
    .single()
  
  // If supplier not found, use a default object
  // Map the correct field names for the component
  const supplierData = supplier ? {
    id: supplier.id,
    vendor_name: supplier.vendor_name,
    vendor_type: supplier.vendor_type,
    vendor_email: supplier.email,  // Map 'email' to 'vendor_email'
    vendor_phone: supplier.vendor_phone || '',
    contact_name: supplier.contact_name,
    country: supplier.country,
    address: supplier.address
  } : {
    id: order.supplier_id,
    vendor_name: 'Unknown Supplier',
    vendor_type: 'unknown',
    vendor_email: '',
    vendor_phone: '',
    contact_name: '',
    country: '',
    address: ''
  }

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
      price_tier_id
    `)
    .eq('purchase_order_id', order.id)

  // Fetch product details for each item
  const itemsWithDetails = await Promise.all(
    (items || []).map(async (item) => {
      const { data: product } = await supabase
        .from('products')
        .select('id, product_name, sku, description, unit_of_measure')
        .eq('id', item.product_id)
        .single()

      const { data: productSupplier } = await supabase
        .from('product_suppliers')
        .select('id, lead_time_days, moq')
        .eq('id', item.product_supplier_id)
        .single()

      const { data: priceTier } = item.price_tier_id ? await supabase
        .from('supplier_price_tiers')
        .select('id, minimum_order_quantity, unit_price')
        .eq('id', item.price_tier_id)
        .single() : { data: null }

      return {
        ...item,
        product,
        product_supplier: productSupplier,
        price_tier: priceTier
      }
    })
  )

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

  // Fetch seller data
  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', order.seller_id)
    .single()

  // Combine all data
  const orderWithDetails = {
    ...order,
    supplier: supplierData,
    seller: seller || {},
    items: itemsWithDetails,
    status_history: statusHistoryWithUsers || []
  }

  return <PurchaseOrderDetail order={orderWithDetails} />
}