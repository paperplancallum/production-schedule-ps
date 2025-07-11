import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request, { params }) {
  try {
    const supabase = await createClient()
    const { id: orderId } = params
    const body = await request.json()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if order exists and is in draft status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, status')
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (existingOrder.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Items can only be added to draft purchase orders' 
      }, { status: 400 })
    }

    // Add item to purchase order
    const { data, error } = await supabase
      .from('purchase_order_items')
      .insert({
        purchase_order_id: orderId,
        ...body
      })
      .select(`
        *,
        product:products(
          id,
          product_name,
          sku
        )
      `)
      .single()

    if (error) {
      console.error('Error adding item to purchase order:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/purchase-orders/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request, { params }) {
  try {
    const supabase = await createClient()
    const { id: orderId } = params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')
    const body = await request.json()

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if order exists and is in draft status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, status')
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (existingOrder.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Items can only be updated in draft purchase orders' 
      }, { status: 400 })
    }

    // Update item
    const { data, error } = await supabase
      .from('purchase_order_items')
      .update(body)
      .eq('id', itemId)
      .eq('purchase_order_id', orderId)
      .select(`
        *,
        product:products(
          id,
          product_name,
          sku
        )
      `)
      .single()

    if (error) {
      console.error('Error updating purchase order item:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in PATCH /api/purchase-orders/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()
    const { id: orderId } = params
    const { searchParams } = new URL(request.url)
    const itemId = searchParams.get('itemId')

    if (!itemId) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if order exists and is in draft status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, status')
      .eq('id', orderId)
      .eq('seller_id', user.id)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    if (existingOrder.status !== 'draft') {
      return NextResponse.json({ 
        error: 'Items can only be deleted from draft purchase orders' 
      }, { status: 400 })
    }

    // Delete item
    const { error } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('id', itemId)
      .eq('purchase_order_id', orderId)

    if (error) {
      console.error('Error deleting purchase order item:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/purchase-orders/[id]/items:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}