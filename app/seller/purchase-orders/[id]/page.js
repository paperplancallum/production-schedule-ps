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

  // Fetch supplier details separately with only existing fields
  const { data: supplier, error: supplierError } = await supabase
    .from('vendors')
    .select('*')  // Get all fields to avoid column name issues
    .eq('id', order.supplier_id)
    .single()
  
  // Log error if any
  if (supplierError) {
    console.error('Failed to fetch supplier:', {
      error: supplierError,
      supplier_id: order.supplier_id,
      order_id: order.id
    })
  }
  
  // If supplier not found, use a default object
  // Map the correct field names for the component
  const supplierData = supplier ? {
    id: supplier.id,
    vendor_name: supplier.vendor_name,
    vendor_type: supplier.vendor_type,
    vendor_email: supplier.email || '',
    vendor_phone: '',  // vendor_phone doesn't exist in table
    contact_person: supplier.contact_person || supplier.contact_name || '',
    address_line1: supplier.address_line1 || '',
    address_line2: supplier.address_line2 || '',
    city: supplier.city || '',
    state: supplier.state || '',
    zip_code: supplier.zip_code || '',
    country: supplier.country || '',
    tax_id: supplier.tax_id || '',
    // Keep legacy fields for backward compatibility
    contact_name: supplier.contact_person || supplier.contact_name || '',
    address: supplier.address || ''
  } : {
    id: order.supplier_id,
    vendor_name: 'Unknown Supplier',
    vendor_type: 'unknown',
    vendor_email: '',
    vendor_phone: '',
    contact_person: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    tax_id: '',
    // Legacy fields
    contact_name: '',
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