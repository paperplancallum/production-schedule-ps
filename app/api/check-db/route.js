import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Try to query product_suppliers to check column names
    const { data: psData, error: psError } = await supabase
      .from('product_suppliers')
      .select('*')
      .limit(1)
    
    // Try to check if RLS policies are causing issues
    const { data: priceTierData, error: priceTierError } = await supabase
      .from('supplier_price_tiers')
      .select('*')
      .limit(1)
    
    return NextResponse.json({
      product_suppliers: {
        success: !psError,
        error: psError?.message,
        columns: psData && psData.length > 0 ? Object.keys(psData[0]) : []
      },
      supplier_price_tiers: {
        success: !priceTierError,
        error: priceTierError?.message
      },
      migration_hint: 'If you see "column ps.supplier_id does not exist", the migrations in /supabase/migrations/20250111_fix_rls_policies.sql need to be applied'
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}