import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { supplierId } = await params

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all products that have this supplier
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        *,
        product_suppliers!inner (
          id,
          vendor_id,
          lead_time_days,
          moq,
          is_primary,
          price_tiers:supplier_price_tiers (
            id,
            minimum_order_quantity,
            unit_price
          )
        )
      `)
      .eq('seller_id', user.id)
      .eq('product_suppliers.vendor_id', supplierId)
      .order('product_name')

    if (error) {
      console.error('Error fetching products:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(products || [])
  } catch (error) {
    console.error('Error in GET /api/products/supplier/[supplierId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}