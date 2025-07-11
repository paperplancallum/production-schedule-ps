import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PurchaseOrderDetail from './purchase-order-detail'

export default async function PurchaseOrderPage({ params }) {
  const supabase = await createClient()
  
  // Get purchase order with all related data
  const { data: order, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      supplier:vendors!supplier_id(
        id,
        vendor_name,
        vendor_type,
        vendor_email,
        vendor_phone
      ),
      items:purchase_order_items(
        id,
        quantity,
        unit_price,
        line_total,
        notes,
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
      ),
      status_history:purchase_order_status_history(
        id,
        from_status,
        to_status,
        notes,
        created_at,
        changed_by
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !order) {
    notFound()
  }

  return <PurchaseOrderDetail order={order} />
}