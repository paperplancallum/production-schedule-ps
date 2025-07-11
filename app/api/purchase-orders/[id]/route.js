import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch purchase order with related data
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:vendors!supplier_id(
          id,
          vendor_code,
          business_address,
          phone_number,
          profile:profiles!vendors_id_fkey(
            company_name
          )
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
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
      }
      console.error('Error fetching purchase order:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = params
    const body = await request.json()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update this order
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, supplier_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions = {
        'draft': ['submitted', 'cancelled'],
        'submitted': ['accepted', 'cancelled'],
        'accepted': ['in_progress', 'cancelled'],
        'in_progress': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'cancelled'],
        'delivered': [],
        'cancelled': []
      }

      if (!validTransitions[existingOrder.status]?.includes(body.status)) {
        return NextResponse.json({ 
          error: `Cannot transition from ${existingOrder.status} to ${body.status}` 
        }, { status: 400 })
      }
    }

    // Update purchase order
    const { data, error } = await supabase
      .from('purchase_orders')
      .update(body)
      .eq('id', id)
      .select(`
        *,
        supplier:vendors!supplier_id(
          id,
          vendor_code,
          profile:profiles!vendors_id_fkey(
            company_name
          )
        )
      `)
      .single()

    if (error) {
      console.error('Error updating purchase order:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if order exists and is in draft status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, status')
      .eq('id', id)
      .eq('seller_id', user.id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (existingOrder.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Only draft purchase orders can be deleted' 
      }, { status: 400 })
    }

    // Delete purchase order (items will cascade)
    const { error } = await supabase
      .from('purchase_orders')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting purchase order:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}