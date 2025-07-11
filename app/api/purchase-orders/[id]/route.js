import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = await params

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
          vendor_name,
          email,
          address,
          contact_name
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
    const { id } = await params
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

    // Check if user is either the seller or the supplier
    let hasPermission = false
    if (existingOrder.seller_id === user.id) {
      hasPermission = true
    } else {
      // Check if user is the supplier
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', existingOrder.supplier_id)
        .eq('user_id', user.id)
        .single()
      
      if (vendor) {
        hasPermission = true
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Validate status transitions
    if (body.status) {
      const validTransitions = {
        'draft': ['sent_to_supplier', 'cancelled'],
        'sent_to_supplier': ['approved', 'cancelled'],
        'approved': ['in_progress', 'cancelled'],
        'in_progress': ['complete', 'cancelled'],
        'complete': [],
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
          vendor_name,
          email
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

export async function PUT(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const body = await request.json()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to update this order
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, status')
      .eq('id', id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (existingOrder.seller_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (existingOrder.status !== 'draft') {
      return NextResponse.json({ error: 'Can only edit orders in draft status' }, { status: 400 })
    }

    // Start a transaction by updating the purchase order first
    const { data: updatedOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        notes: body.notes,
        trade_terms: body.trade_terms,
        subtotal: body.subtotal,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating purchase order:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Delete existing items
    const { error: deleteError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', id)

    if (deleteError) {
      console.error('Error deleting existing items:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    // Insert updated items
    if (body.items && body.items.length > 0) {
      const itemsToInsert = body.items.map(item => ({
        purchase_order_id: id,
        product_id: item.product_id,
        product_supplier_id: item.product_supplier_id,
        price_tier_id: item.price_tier_id,
        quantity: item.quantity,
        unit_price: item.unit_price
      }))

      const { error: insertError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert)

      if (insertError) {
        console.error('Error inserting items:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 400 })
      }
    }

    // Fetch the complete updated order with all relations
    const { data: completeOrder, error: fetchCompleteError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:vendors!supplier_id(
          id,
          vendor_code,
          vendor_name,
          email,
          address,
          contact_name
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

    if (fetchCompleteError) {
      console.error('Error fetching complete order:', fetchCompleteError)
      return NextResponse.json({ error: fetchCompleteError.message }, { status: 400 })
    }

    return NextResponse.json(completeOrder)
  } catch (error) {
    console.error('Error in PUT /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()
    const { id } = await params

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