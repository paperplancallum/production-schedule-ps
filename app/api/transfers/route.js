import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build query
    let query = supabase
      .from('transfers')
      .select(`
        *,
        transfer_items (
          id,
          sku,
          product_name,
          quantity,
          unit
        )
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching transfers:', error)
      return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 })
    }

    // Rename transfer_items to items for consistency
    const transfers = data.map(transfer => ({
      ...transfer,
      items: transfer.transfer_items || [],
      transfer_items: undefined
    }))

    return NextResponse.json(transfers, { status: 200 })
  } catch (error) {
    console.error('Error in transfers GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const supabase = await createClient()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { items, ...transferData } = body

    // Insert transfer
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .insert({
        ...transferData,
        seller_id: user.id
      })
      .select()
      .single()

    if (transferError) {
      console.error('Error creating transfer:', transferError)
      return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 })
    }

    // Insert transfer items if provided
    if (items && items.length > 0) {
      const transferItems = items.map(item => ({
        transfer_id: transfer.id,
        sku: item.sku,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit
      }))

      const { error: itemsError } = await supabase
        .from('transfer_items')
        .insert(transferItems)

      if (itemsError) {
        console.error('Error creating transfer items:', itemsError)
        // Rollback transfer creation
        await supabase.from('transfers').delete().eq('id', transfer.id)
        return NextResponse.json({ error: 'Failed to create transfer items' }, { status: 500 })
      }
    }

    // Fetch the complete transfer with items
    const { data: completeTransfer, error: fetchError } = await supabase
      .from('transfers')
      .select(`
        *,
        transfer_items (
          id,
          sku,
          product_name,
          quantity,
          unit
        )
      `)
      .eq('id', transfer.id)
      .single()

    if (fetchError) {
      console.error('Error fetching complete transfer:', fetchError)
      return NextResponse.json(transfer, { status: 201 })
    }

    // Rename transfer_items to items
    const result = {
      ...completeTransfer,
      items: completeTransfer.transfer_items || [],
      transfer_items: undefined
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error in transfers POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}