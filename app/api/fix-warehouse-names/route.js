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

    // Fetch all transfers for the user
    const { data: transfers, error: fetchError } = await supabase
      .from('transfers')
      .select('id, from_location, to_location, transfer_number')
      .eq('seller_id', user.id)
      .limit(50)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 })
    }

    // Find transfers that need updating
    const needsUpdate = transfers.filter(transfer => {
      const fromNeedsUpdate = transfer.from_location && 
        transfer.from_location.toLowerCase().endsWith('warehouse') && 
        !transfer.from_location.includes('(Warehouse)') &&
        transfer.from_location !== 'Supplier Warehouse' &&
        transfer.from_location !== '3PL Warehouse'
        
      const toNeedsUpdate = transfer.to_location && 
        transfer.to_location.toLowerCase().endsWith('warehouse') && 
        !transfer.to_location.includes('(Warehouse)') &&
        transfer.to_location !== 'Supplier Warehouse' &&
        transfer.to_location !== '3PL Warehouse'
        
      return fromNeedsUpdate || toNeedsUpdate
    })

    return NextResponse.json({
      totalTransfers: transfers.length,
      needsUpdate: needsUpdate.length,
      examples: needsUpdate.slice(0, 10).map(t => ({
        id: t.id,
        transfer_number: t.transfer_number,
        from_location: t.from_location,
        to_location: t.to_location,
        from_needs_update: t.from_location && t.from_location.toLowerCase().endsWith('warehouse') && !t.from_location.includes('(Warehouse)'),
        to_needs_update: t.to_location && t.to_location.toLowerCase().endsWith('warehouse') && !t.to_location.includes('(Warehouse)')
      }))
    })
  } catch (error) {
    console.error('Error in GET fix-warehouse-names:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all transfers for the user
    const { data: transfers, error: fetchError } = await supabase
      .from('transfers')
      .select('id, from_location, to_location')
      .eq('seller_id', user.id)

    if (fetchError) {
      console.error('Error fetching transfers:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 })
    }

    let updatedCount = 0
    const updates = []

    console.log(`Processing ${transfers.length} transfers...`)

    // Process each transfer
    for (const transfer of transfers) {
      let needsUpdate = false
      let newFromLocation = transfer.from_location
      let newToLocation = transfer.to_location

      // Update from_location if it ends with "Warehouse" but not "(Warehouse)"
      if (transfer.from_location && 
          transfer.from_location.toLowerCase().endsWith('warehouse') && 
          !transfer.from_location.includes('(Warehouse)') &&
          transfer.from_location !== 'Supplier Warehouse' &&
          transfer.from_location !== '3PL Warehouse') {
        // Replace " Warehouse" with " (Warehouse)"
        newFromLocation = transfer.from_location.replace(/\s+Warehouse$/i, ' (Warehouse)')
        needsUpdate = true
        console.log(`Will update from_location: "${transfer.from_location}" -> "${newFromLocation}"`)
      }

      // Update to_location if it ends with "Warehouse" but not "(Warehouse)"
      if (transfer.to_location && 
          transfer.to_location.toLowerCase().endsWith('warehouse') && 
          !transfer.to_location.includes('(Warehouse)') &&
          transfer.to_location !== 'Supplier Warehouse' &&
          transfer.to_location !== '3PL Warehouse') {
        // Replace " Warehouse" with " (Warehouse)"
        newToLocation = transfer.to_location.replace(/\s+Warehouse$/i, ' (Warehouse)')
        needsUpdate = true
        console.log(`Will update to_location: "${transfer.to_location}" -> "${newToLocation}"`)
      }

      if (needsUpdate) {
        updates.push({
          id: transfer.id,
          from_location: newFromLocation,
          to_location: newToLocation,
          original_from: transfer.from_location,
          original_to: transfer.to_location
        })
      }
    }

    // Update transfers in batches
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('transfers')
        .update({
          from_location: update.from_location,
          to_location: update.to_location
        })
        .eq('id', update.id)

      if (updateError) {
        console.error(`Error updating transfer ${update.id}:`, updateError)
      } else {
        updatedCount++
        console.log(`Updated transfer ${update.id}: "${update.original_to}" -> "${update.to_location}"`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} out of ${updates.length} transfers`,
      totalTransfers: transfers.length,
      updates: updates.slice(0, 10) // Show first 10 updates as examples
    })

  } catch (error) {
    console.error('Error in fix-warehouse-names:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}