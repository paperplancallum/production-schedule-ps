import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Query transfers with warehouse locations and include purchase_order data
    const { data: transfers, error: transfersError } = await supabase
      .from('transfers')
      .select(`
        *,
        purchase_order:purchase_orders(
          id,
          po_number,
          supplier_id,
          supplier:vendors(
            id,
            vendor_name
          )
        )
      `)
      .eq('seller_id', user.id)
      // Remove filter to see all transfers
      // .or('to_location.ilike.%warehouse%,from_location.ilike.%warehouse%')
      .order('created_at', { ascending: false })
      .limit(20)

    if (transfersError) {
      console.error('Transfers query error:', transfersError)
      return NextResponse.json({ 
        error: 'Failed to fetch transfers', 
        details: transfersError.message 
      }, { status: 500 })
    }

    // Also get a sample of purchase orders to verify data structure
    const { data: samplePOs, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        supplier_id,
        supplier:vendors(
          id,
          vendor_name
        )
      `)
      .eq('seller_id', user.id)
      .limit(10)

    if (poError) {
      console.error('Purchase orders query error:', poError)
    }

    // Get count of transfers with/without purchase_order_id
    const { count: withPO } = await supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .not('purchase_order_id', 'is', null)

    const { count: withoutPO } = await supabase
      .from('transfers')
      .select('*', { count: 'exact', head: true })
      .is('purchase_order_id', null)

    return NextResponse.json({
      summary: {
        totalTransfersWithWarehouse: transfers?.length || 0,
        transfersWithPurchaseOrder: withPO || 0,
        transfersWithoutPurchaseOrder: withoutPO || 0
      },
      transfers: transfers || [],
      samplePurchaseOrders: samplePOs || [],
      debug: {
        message: 'Check if purchase_order_id values in transfers match actual purchase order IDs',
        transferStructure: transfers?.[0] ? Object.keys(transfers[0]) : [],
        poStructure: samplePOs?.[0] ? Object.keys(samplePOs[0]) : []
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error.message 
    }, { status: 500 })
  }
}