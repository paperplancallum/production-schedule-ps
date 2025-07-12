import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const sku = searchParams.get('sku')

    // Fetch purchase orders that are approved, in progress, or complete
    const { data: purchaseOrders, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        id,
        po_number,
        status,
        items:purchase_order_items(
          id,
          quantity,
          product:products(
            id,
            sku,
            product_name,
            unit_of_measure
          )
        )
      `)
      .eq('seller_id', user.id)
      .in('status', ['approved', 'in_progress', 'complete'])

    if (poError) {
      console.error('Error fetching purchase orders:', poError)
    }

    // Fetch all transfers with items
    let query = supabase
      .from('transfers')
      .select(`
        id,
        transfer_number,
        transfer_type,
        from_location,
        to_location,
        status,
        created_at,
        purchase_order_id,
        purchase_order:purchase_orders!purchase_order_id(
          id,
          po_number,
          supplier:vendors!supplier_id(
            id,
            vendor_name
          )
        ),
        items:transfer_items(
          id,
          sku,
          quantity,
          unit,
          product_name
        )
      `)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: true })

    const { data: transfers, error: transfersError } = await query

    if (transfersError) {
      console.error('Error fetching transfers:', transfersError)
      return NextResponse.json({ error: transfersError.message }, { status: 400 })
    }

    console.log('Fetched data:', {
      purchaseOrders: purchaseOrders?.length || 0,
      transfers: transfers?.length || 0
    })
    
    if (purchaseOrders?.length > 0) {
      console.log('Sample PO:', {
        po_number: purchaseOrders[0].po_number,
        status: purchaseOrders[0].status,
        items: purchaseOrders[0].items?.length
      })
    }

    // Calculate inventory positions
    const inventoryByLocation = {}
    const inventoryBySku = {}
    const movements = []

    // First, calculate what's been transferred from each PO
    const transferredByPO = {}
    transfers.forEach(transfer => {
      if (transfer.purchase_order_id) {
        if (!transferredByPO[transfer.purchase_order_id]) {
          transferredByPO[transfer.purchase_order_id] = {}
        }
        transfer.items?.forEach(item => {
          if (!transferredByPO[transfer.purchase_order_id][item.sku]) {
            transferredByPO[transfer.purchase_order_id][item.sku] = 0
          }
          transferredByPO[transfer.purchase_order_id][item.sku] += item.quantity
        })
      }
    })

    // Calculate production inventory from POs that haven't been fully transferred
    if (purchaseOrders) {
      purchaseOrders.forEach(po => {
        po.items?.forEach(item => {
          if (item.product) {
            const sku = item.product.sku
            const product_name = item.product.product_name
            const unit_of_measure = item.product.unit_of_measure
            const poQuantity = item.quantity
            
            // Check how much has been transferred
            const transferredQty = transferredByPO[po.id]?.[sku] || 0
            const remainingQty = poQuantity - transferredQty
            
            if (remainingQty > 0) {
              const location = 'Production'
              
              if (!inventoryByLocation[location]) {
                inventoryByLocation[location] = {}
              }
              if (!inventoryByLocation[location][sku]) {
                inventoryByLocation[location][sku] = {
                  sku,
                  product_name,
                  quantity: 0,
                  unit_of_measure
                }
              }
              inventoryByLocation[location][sku].quantity += remainingQty
              
              if (!inventoryBySku[sku]) {
                inventoryBySku[sku] = {
                  sku,
                  product_name,
                  unit_of_measure,
                  total_quantity: 0,
                  locations: {},
                  suppliers: {} // Track suppliers for items in supplier warehouses
                }
              }
              if (!inventoryBySku[sku].locations[location]) {
                inventoryBySku[sku].locations[location] = 0
              }
              inventoryBySku[sku].locations[location] += remainingQty
              inventoryBySku[sku].total_quantity += remainingQty
            }
          }
        })
      })
    }
    
    // Process each transfer
    transfers.forEach(transfer => {
      transfer.items?.forEach(item => {
        const { sku, quantity, product_name, unit } = item
        
        // Initialize SKU data if not exists
        if (!inventoryBySku[sku]) {
          inventoryBySku[sku] = {
            sku,
            product_name,
            unit_of_measure: unit,
            total_quantity: 0,
            locations: {},
            suppliers: {} // Track suppliers for items in supplier warehouses
          }
        }

        // Create movement record
        const movement = {
          id: `${transfer.id}-${item.id}`,
          transfer_number: transfer.transfer_number,
          transfer_date: transfer.created_at,
          sku,
          product_name,
          quantity,
          unit_of_measure: unit,
          transfer_type: transfer.transfer_type,
          from_location: transfer.from_location,
          to_location: transfer.to_location,
          po_number: transfer.purchase_order?.po_number,
          supplier: transfer.purchase_order?.supplier?.vendor_name
        }
        movements.push(movement)

        // Update inventory based on transfer type
        if (transfer.transfer_type === 'in') {
          // 'in' transfers add goods to the destination (already accounted for in Production calculation)
          // Normalize destination location name
          let location = transfer.to_location || 'Supplier Warehouse'
          
          // Store original location before normalization for supplier extraction
          const originalLocationForSupplier = transfer.to_location
          
          if (location.toLowerCase().includes('warehouse') && !location.toLowerCase().includes('3pl')) {
            location = 'Supplier Warehouse'
          } else if (location.toLowerCase().includes('3pl')) {
            location = '3PL Warehouse'
          } else if (location.toLowerCase().includes('amazon') || location.toLowerCase().includes('fba')) {
            location = 'Amazon FBA'
          }
          
          // Add to destination
          if (!inventoryByLocation[location]) {
            inventoryByLocation[location] = {}
          }
          if (!inventoryByLocation[location][sku]) {
            inventoryByLocation[location][sku] = {
              sku,
              product_name,
              quantity: 0,
              unit_of_measure: unit,
              supplier_name: null
            }
          }
          inventoryByLocation[location][sku].quantity += quantity
          
          // Track supplier for items in supplier warehouse
          if (location === 'Supplier Warehouse') {
            // Extract supplier name from the original location (e.g., "ABC Supplier (Warehouse)" -> "ABC Supplier")
            let supplierName = null
            
            // Check if we have supplier info from purchase order
            if (transfer.purchase_order?.supplier?.vendor_name) {
              supplierName = transfer.purchase_order.supplier.vendor_name
              console.log(`Found supplier from PO: ${supplierName} for SKU: ${sku}`)
            } else if (originalLocationForSupplier) {
              // Try to extract supplier name from various formats
              if (originalLocationForSupplier.includes('(Warehouse)')) {
                // New format: "Supplier Name (Warehouse)"
                supplierName = originalLocationForSupplier.replace(' (Warehouse)', '').trim()
                console.log(`Extracted supplier from location (new format): ${supplierName} from ${originalLocationForSupplier}`)
              } else if (originalLocationForSupplier.toLowerCase() === 'supplier warehouse') {
                // Generic supplier warehouse - check from_location
                if (transfer.from_location && transfer.from_location !== 'Production') {
                  supplierName = transfer.from_location
                  console.log(`Using from_location as supplier: ${supplierName}`)
                }
              } else if (originalLocationForSupplier.toLowerCase().includes('warehouse')) {
                // Legacy format: "Supplier Name Warehouse" 
                supplierName = originalLocationForSupplier.replace(/\s*[Ww]arehouse\s*$/, '').trim()
                console.log(`Extracted supplier from location (legacy): ${supplierName} from ${originalLocationForSupplier}`)
              } else {
                // Last resort - use the location as-is if it's not a generic location
                const genericLocations = ['production', '3pl', 'amazon', 'fba']
                if (!genericLocations.some(g => originalLocationForSupplier.toLowerCase().includes(g))) {
                  supplierName = originalLocationForSupplier
                  console.log(`Using location as supplier name: ${supplierName}`)
                }
              }
            }
            
            if (!supplierName || supplierName === 'Supplier Warehouse') {
              console.log(`No valid supplier found for transfer ${transfer.transfer_number}, location: ${originalLocationForSupplier}, from: ${transfer.from_location}`)
            }
            
            if (supplierName && supplierName !== 'Supplier') {
              inventoryByLocation[location][sku].supplier_name = supplierName
              // Also track in the main SKU data
              if (!inventoryBySku[sku].suppliers[location]) {
                inventoryBySku[sku].suppliers[location] = {}
              }
              inventoryBySku[sku].suppliers[location][supplierName] = 
                (inventoryBySku[sku].suppliers[location][supplierName] || 0) + quantity
              console.log(`Set supplier ${supplierName} for SKU ${sku} in Supplier Warehouse`)
            } else {
              console.log(`Skipping supplier assignment: supplierName=${supplierName}`)
            }
          }

          if (!inventoryBySku[sku].locations[location]) {
            inventoryBySku[sku].locations[location] = 0
          }
          inventoryBySku[sku].locations[location] += quantity
          // Note: We don't change total_quantity since it's just moving locations

        } else if (transfer.transfer_type === 'transfer') {
          // Moving between locations - normalize location names
          let fromLoc = transfer.from_location
          let toLoc = transfer.to_location
          
          // Normalize from location
          if (fromLoc) {
            if (fromLoc.toLowerCase().includes('warehouse') && !fromLoc.toLowerCase().includes('3pl')) {
              fromLoc = 'Supplier Warehouse'
            } else if (fromLoc.toLowerCase().includes('3pl')) {
              fromLoc = '3PL Warehouse'
            } else if (fromLoc.toLowerCase().includes('amazon') || fromLoc.toLowerCase().includes('fba')) {
              fromLoc = 'Amazon FBA'
            } else if (fromLoc.toLowerCase().includes('production')) {
              fromLoc = 'Production'
            }
          }
          
          // Normalize to location
          if (toLoc) {
            if (toLoc.toLowerCase().includes('warehouse') && !toLoc.toLowerCase().includes('3pl')) {
              toLoc = 'Supplier Warehouse'
            } else if (toLoc.toLowerCase().includes('3pl')) {
              toLoc = '3PL Warehouse'
            } else if (toLoc.toLowerCase().includes('amazon') || toLoc.toLowerCase().includes('fba')) {
              toLoc = 'Amazon FBA'
            } else if (toLoc.toLowerCase().includes('production')) {
              toLoc = 'Production'
            }
          }

          // Deduct from source location
          if (fromLoc) {
            if (!inventoryByLocation[fromLoc]) {
              inventoryByLocation[fromLoc] = {}
            }
            if (!inventoryByLocation[fromLoc][sku]) {
              inventoryByLocation[fromLoc][sku] = {
                sku,
                product_name,
                quantity: 0,
                unit_of_measure: unit,
                supplier_name: null
              }
            }
            inventoryByLocation[fromLoc][sku].quantity -= quantity
            
            // Track supplier for items being removed from supplier warehouse
            if (fromLoc === 'Supplier Warehouse') {
              // Extract supplier name from the original location
              let supplierName = null
              const originalFromLocation = transfer.from_location
              
              if (originalFromLocation && originalFromLocation.includes('(Warehouse)')) {
                // Extract supplier name from location format "Supplier Name (Warehouse)"
                supplierName = originalFromLocation.replace(' (Warehouse)', '').trim()
              } else if (originalFromLocation && originalFromLocation.toLowerCase().includes('warehouse')) {
                // Handle legacy format "Supplier Name Warehouse"
                supplierName = originalFromLocation.replace(/\s*[Ww]arehouse\s*$/, '').trim()
              }
              
              if (supplierName && supplierName !== 'Supplier') {
                inventoryByLocation[fromLoc][sku].supplier_name = supplierName
                // Update supplier tracking in main SKU data
                if (inventoryBySku[sku].suppliers && inventoryBySku[sku].suppliers[fromLoc]) {
                  if (inventoryBySku[sku].suppliers[fromLoc][supplierName]) {
                    inventoryBySku[sku].suppliers[fromLoc][supplierName] -= quantity
                    if (inventoryBySku[sku].suppliers[fromLoc][supplierName] <= 0) {
                      delete inventoryBySku[sku].suppliers[fromLoc][supplierName]
                    }
                  }
                }
              }
            }

            if (!inventoryBySku[sku].locations[fromLoc]) {
              inventoryBySku[sku].locations[fromLoc] = 0
            }
            inventoryBySku[sku].locations[fromLoc] -= quantity
          }

          // Add to destination location
          if (toLoc) {
            if (!inventoryByLocation[toLoc]) {
              inventoryByLocation[toLoc] = {}
            }
            if (!inventoryByLocation[toLoc][sku]) {
              inventoryByLocation[toLoc][sku] = {
                sku,
                product_name,
                quantity: 0,
                unit_of_measure: unit,
                supplier_name: null
              }
            }
            inventoryByLocation[toLoc][sku].quantity += quantity
            
            // Track supplier for items in supplier warehouse
            if (toLoc === 'Supplier Warehouse') {
              // Extract supplier name from the original location
              let supplierName = null
              const originalToLocation = transfer.to_location
              
              if (originalToLocation && originalToLocation.includes('(Warehouse)')) {
                // Extract supplier name from location format "Supplier Name (Warehouse)"
                supplierName = originalToLocation.replace(' (Warehouse)', '').trim()
              } else if (originalToLocation && originalToLocation.toLowerCase().includes('warehouse')) {
                // Handle legacy format "Supplier Name Warehouse"
                supplierName = originalToLocation.replace(/\s*[Ww]arehouse\s*$/, '').trim()
              }
              
              if (supplierName && supplierName !== 'Supplier') {
                inventoryByLocation[toLoc][sku].supplier_name = supplierName
                // Also track in the main SKU data
                if (!inventoryBySku[sku].suppliers[toLoc]) {
                  inventoryBySku[sku].suppliers[toLoc] = {}
                }
                inventoryBySku[sku].suppliers[toLoc][supplierName] = 
                  (inventoryBySku[sku].suppliers[toLoc][supplierName] || 0) + quantity
              }
            }

            if (!inventoryBySku[sku].locations[toLoc]) {
              inventoryBySku[sku].locations[toLoc] = 0
            }
            inventoryBySku[sku].locations[toLoc] += quantity
          }

        } else if (transfer.transfer_type === 'out') {
          // Removing from inventory (e.g., sold, damaged, returned)
          const location = transfer.from_location
          
          if (location) {
            if (!inventoryByLocation[location]) {
              inventoryByLocation[location] = {}
            }
            if (!inventoryByLocation[location][sku]) {
              inventoryByLocation[location][sku] = {
                sku,
                product_name,
                quantity: 0,
                unit_of_measure: unit
              }
            }
            inventoryByLocation[location][sku].quantity -= quantity

            if (!inventoryBySku[sku].locations[location]) {
              inventoryBySku[sku].locations[location] = 0
            }
            inventoryBySku[sku].locations[location] -= quantity
            inventoryBySku[sku].total_quantity -= quantity
          }
        }
      })
    })

    console.log('Transferred by PO:', transferredByPO)
    console.log('Inventory by location:', Object.keys(inventoryByLocation))
    console.log('Location totals:', Object.entries(inventoryByLocation).map(([loc, skus]) => ({
      location: loc,
      skuCount: Object.keys(skus).length,
      totalQty: Object.values(skus).reduce((sum, s) => sum + s.quantity, 0)
    })))
    
    // Debug supplier information
    if (inventoryByLocation['Supplier Warehouse']) {
      console.log('Supplier Warehouse inventory:', Object.entries(inventoryByLocation['Supplier Warehouse']).map(([sku, data]) => ({
        sku,
        quantity: data.quantity,
        supplier_name: data.supplier_name
      })))
    }
    
    // Debug transfers to supplier warehouse
    const supplierTransfers = transfers.filter(t => 
      t.to_location?.toLowerCase().includes('warehouse') || 
      t.from_location?.toLowerCase().includes('warehouse')
    )
    console.log('Supplier warehouse transfers:', supplierTransfers.map(t => ({
      transfer_number: t.transfer_number,
      from: t.from_location,
      to: t.to_location,
      supplier: t.purchase_order?.supplier?.vendor_name
    })))

    // Convert to arrays and filter out zero quantities
    const locationSummary = Object.entries(inventoryByLocation).map(([location, skus]) => {
      const skuList = Object.values(skus).filter(item => item.quantity !== 0)
      const totalQuantity = skuList.reduce((sum, item) => sum + item.quantity, 0)
      return {
        location,
        total_quantity: totalQuantity,
        sku_count: skuList.length,
        skus: skuList
      }
    }).filter(loc => loc.total_quantity !== 0)

    const skuSummary = Object.values(inventoryBySku).map(sku => {
      // Filter out locations with zero quantity
      const activeLocations = Object.entries(sku.locations)
        .filter(([_, qty]) => qty !== 0)
        .reduce((acc, [loc, qty]) => ({ ...acc, [loc]: qty }), {})
      
      // Get primary supplier if item is in supplier warehouse
      let supplier_name = null
      if (sku.suppliers && sku.suppliers['Supplier Warehouse']) {
        // Get the supplier with the most quantity
        const suppliers = Object.entries(sku.suppliers['Supplier Warehouse'])
        if (suppliers.length > 0) {
          suppliers.sort((a, b) => b[1] - a[1]) // Sort by quantity descending
          supplier_name = suppliers[0][0] // Get the supplier name with most quantity
        }
      }
      
      return {
        ...sku,
        locations: activeLocations,
        location_count: Object.keys(activeLocations).length,
        supplier_name
      }
    }).filter(sku => sku.total_quantity !== 0)

    // Filter results based on query parameters
    let filteredLocationSummary = locationSummary
    let filteredSkuSummary = skuSummary
    let filteredMovements = movements

    if (location) {
      // Map location parameter to actual location names
      const locationMap = {
        'production': 'production',
        'supplier_warehouse': 'warehouse',  // Match any warehouse
        '3pl_warehouse': '3pl',
        'amazon_fba': 'amazon|fba'
      }
      
      const searchPattern = locationMap[location] || location.toLowerCase()
      
      filteredLocationSummary = locationSummary.filter(loc => {
        const locLower = loc.location.toLowerCase()
        if (location === 'supplier_warehouse') {
          return locLower.includes('supplier') || (locLower.includes('warehouse') && !locLower.includes('3pl'))
        }
        return locLower.includes(searchPattern.split('|')[0]) || 
               (searchPattern.includes('|') && locLower.includes(searchPattern.split('|')[1]))
      })
      
      filteredMovements = movements.filter(m => {
        const fromLower = m.from_location?.toLowerCase() || ''
        const toLower = m.to_location?.toLowerCase() || ''
        
        if (location === 'supplier_warehouse') {
          return fromLower.includes('warehouse') || toLower.includes('warehouse') ||
                 fromLower.includes('supplier') || toLower.includes('supplier')
        }
        
        return fromLower.includes(searchPattern.split('|')[0]) || 
               toLower.includes(searchPattern.split('|')[0]) ||
               (searchPattern.includes('|') && (fromLower.includes(searchPattern.split('|')[1]) || 
                                                toLower.includes(searchPattern.split('|')[1])))
      })
    }

    if (sku) {
      filteredSkuSummary = skuSummary.filter(s => 
        s.sku.toLowerCase().includes(sku.toLowerCase())
      )
      filteredMovements = movements.filter(m => 
        m.sku.toLowerCase().includes(sku.toLowerCase())
      )
      
      // Also filter location summary to only show locations with the searched SKU
      filteredLocationSummary = filteredLocationSummary.map(loc => ({
        ...loc,
        skus: loc.skus.filter(s => s.sku.toLowerCase().includes(sku.toLowerCase())),
        sku_count: loc.skus.filter(s => s.sku.toLowerCase().includes(sku.toLowerCase())).length,
        total_quantity: loc.skus
          .filter(s => s.sku.toLowerCase().includes(sku.toLowerCase()))
          .reduce((sum, s) => sum + s.quantity, 0)
      })).filter(loc => loc.sku_count > 0)
    }

    return NextResponse.json({
      summary: {
        total_locations: locationSummary.length,
        total_skus: skuSummary.length,
        total_movements: movements.length
      },
      locations: filteredLocationSummary,
      skus: filteredSkuSummary,
      movements: filteredMovements.slice(-100) // Return last 100 movements
    })

  } catch (error) {
    console.error('Error in GET /api/inventory:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}