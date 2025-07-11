import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build query
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:vendors!purchase_orders_supplier_id_fkey(
          id,
          vendor_name,
          vendor_type
        ),
        items:purchase_order_items(
          id,
          quantity,
          unit_price,
          line_total,
          product:products(
            id,
            product_name,
            sku
          )
        )
      `)
      .order('created_at', { ascending: false })

    // Filter by vendor if provided
    if (vendorId) {
      query = query.eq('supplier_id', vendorId)
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching purchase orders:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/purchase-orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate request body
    const { supplier_id, items, ...orderData } = body
    if (!supplier_id || !items || items.length === 0) {
      return NextResponse.json({ 
        error: 'Supplier ID and items are required' 
      }, { status: 400 })
    }

    // Generate PO number
    const { data: poNumber, error: poError } = await supabase
      .rpc('generate_po_number', { seller_id: user.id })

    if (poError) {
      console.error('Error generating PO number:', poError)
      return NextResponse.json({ error: 'Failed to generate PO number' }, { status: 500 })
    }

    // Create purchase order
    const { data: purchaseOrder, error: createError } = await supabase
      .from('purchase_orders')
      .insert({
        po_number: poNumber,
        seller_id: user.id,
        supplier_id,
        ...orderData
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating purchase order:', createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Create purchase order items
    const itemsToInsert = items.map(item => ({
      purchase_order_id: purchaseOrder.id,
      product_id: item.product_id,
      product_supplier_id: item.product_supplier_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      price_tier_id: item.price_tier_id,
      notes: item.notes
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(itemsToInsert)

    if (itemsError) {
      // Rollback by deleting the purchase order (cascade will delete items)
      await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', purchaseOrder.id)

      console.error('Error creating purchase order items:', itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 400 })
    }

    // Fetch the complete purchase order with items
    const { data: completeOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        supplier:vendors!purchase_orders_supplier_id_fkey(
          id,
          vendor_name,
          vendor_type
        ),
        items:purchase_order_items(
          id,
          quantity,
          unit_price,
          line_total,
          product:products(
            id,
            product_name,
            sku
          )
        )
      `)
      .eq('id', purchaseOrder.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete order:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 400 })
    }

    return NextResponse.json(completeOrder, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/purchase-orders:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}