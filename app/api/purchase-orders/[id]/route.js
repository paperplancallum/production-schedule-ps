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
        seller:sellers!seller_id(
          id,
          full_name,
          company_name,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          business_email,
          business_phone,
          tax_id,
          website,
          email,
          phone_number
        ),
        supplier:vendors!supplier_id(
          id,
          vendor_code,
          vendor_name,
          vendor_email,
          vendor_phone,
          email,
          address,
          contact_name,
          contact_person,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          tax_id
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

    // Fetch user details for status history
    if (data.status_history && data.status_history.length > 0) {
      const statusHistoryWithUsers = await Promise.all(
        data.status_history.map(async (history) => {
          if (!history.changed_by) return history
          
          // Try to find if it's a seller
          const { data: seller } = await supabase
            .from('sellers')
            .select('id, company_name, full_name')
            .eq('id', history.changed_by)
            .single()
          
          if (seller) {
            return { ...history, changed_by_user: { type: 'seller', name: seller.company_name || seller.full_name || 'Seller' } }
          }
          
          // Try to find if it's a vendor
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .eq('user_id', history.changed_by)
            .single()
          
          if (vendor) {
            return { ...history, changed_by_user: { type: 'vendor', name: vendor.vendor_name } }
          }
          
          return history
        })
      )
      
      data.status_history = statusHistoryWithUsers
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
    const { data: existingOrder, error: existingOrderError } = await supabase
      .from('purchase_orders')
      .select('id, seller_id, supplier_id, status, goods_ready_date')
      .eq('id', id)
      .single()

    if (existingOrderError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Check if user is either the seller or the supplier
    let hasPermission = false
    let isVendor = false
    
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
        isVendor = true
      }
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Validate status transitions
    if (body.status) {
      // For vendors, we need to check if the transition is valid even if the seller status doesn't change
      // This is because multiple vendor statuses map to the same seller status
      if (isVendor && body.status === existingOrder.status) {
        // Allow the update to proceed - the vendor status may be changing even if seller status isn't
      } else {
        const validTransitions = {
          'draft': ['sent_to_supplier', 'cancelled'],
          'sent_to_supplier': isVendor ? ['approved', 'cancelled'] : ['cancelled'], // Only vendors can approve
          'approved': isVendor ? ['in_progress'] : ['in_progress', 'cancelled'],
          'in_progress': isVendor ? ['approved', 'complete'] : ['complete', 'cancelled'],
          'complete': [],
          'cancelled': []
        }

        if (!validTransitions[existingOrder.status]?.includes(body.status)) {
          return NextResponse.json({ 
            error: `Cannot transition from ${existingOrder.status} to ${body.status}` 
          }, { status: 400 })
        }
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
      // Check if it's a column not found error
      if (error.message.includes('goods_ready_date') && error.message.includes('column')) {
        return NextResponse.json({ 
          error: 'Database migration required. Please run the migration to add the goods_ready_date column. Check MIGRATION_INSTRUCTIONS.md for details.' 
        }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // If status was updated, create a status history record with user info
    if (body.status && body.status !== existingOrder.status) {
      const { error: historyError } = await supabase
        .from('purchase_order_status_history')
        .insert({
          purchase_order_id: id,
          from_status: existingOrder.status,
          to_status: body.status,
          changed_by: user.id,
          notes: body.statusNote || null
        })

      if (historyError) {
        console.error('Error creating status history:', historyError)
        // Don't fail the request if history creation fails
      }
    }

    // If goods_ready_date was updated, create a status history record
    if (body.goods_ready_date && body.goods_ready_date !== existingOrder.goods_ready_date) {
      const oldDate = existingOrder.goods_ready_date ? new Date(existingOrder.goods_ready_date).toLocaleDateString() : 'not set'
      const newDate = new Date(body.goods_ready_date).toLocaleDateString()
      
      const { error: historyError } = await supabase
        .from('purchase_order_status_history')
        .insert({
          purchase_order_id: id,
          from_status: existingOrder.status,
          to_status: existingOrder.status, // Status doesn't change
          changed_by: user.id,
          notes: `Goods ready date updated from ${oldDate} to ${newDate}`
        })

      if (historyError) {
        console.error('Error creating goods ready date history:', historyError)
        // Don't fail the request if history creation fails
      }
    }

    // Check if this is a vendor making the update and return appropriate format
    if (isVendor) {
      // For vendor updates, return data in the format the vendor page expects
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('id', id)
        .single()
      
      if (orderError) {
        console.error('Error fetching order for vendor:', orderError)
        return NextResponse.json(data)
      }
      
      // Fetch vendor info
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', orderData.supplier_id)
        .single()
      
      // Fetch seller info
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', orderData.seller_id)
        .single()
      
      // Fetch items with products
      const { data: items } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', id)
      
      let itemsWithDetails = items || []
      
      // Fetch product details for items
      if (items && items.length > 0) {
        const productSupplierIds = [...new Set(items.map(item => item.product_supplier_id).filter(Boolean))]
        
        if (productSupplierIds.length > 0) {
          const { data: productSuppliers } = await supabase
            .from('product_suppliers')
            .select(`
              id,
              lead_time_days,
              products:product_id(
                id,
                product_name,
                sku,
                description,
                unit_of_measure
              )
            `)
            .in('id', productSupplierIds)
          
          if (productSuppliers) {
            const suppliersMap = productSuppliers.reduce((acc, ps) => {
              acc[ps.id] = ps
              return acc
            }, {})
            
            itemsWithDetails = items.map(item => ({
              ...item,
              product: suppliersMap[item.product_supplier_id]?.products || null,
              lead_time_days: suppliersMap[item.product_supplier_id]?.lead_time_days || 0
            }))
          }
        }
      }
      
      // Fetch status history
      const { data: statusHistory } = await supabase
        .from('purchase_order_status_history')
        .select('id, from_status, to_status, notes, created_at, changed_by')
        .eq('purchase_order_id', id)
        .order('created_at', { ascending: false })
      
      // Add user info to status history
      const statusHistoryWithUsers = await Promise.all(
        (statusHistory || []).map(async (history) => {
          if (!history.changed_by) return history
          
          const { data: seller } = await supabase
            .from('sellers')
            .select('id, company_name, full_name')
            .eq('id', history.changed_by)
            .single()
          
          if (seller) {
            return { ...history, changed_by_user: { type: 'seller', name: seller.company_name || seller.full_name || 'Seller' } }
          }
          
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .eq('user_id', history.changed_by)
            .single()
          
          if (vendor) {
            return { ...history, changed_by_user: { type: 'vendor', name: vendor.vendor_name } }
          }
          
          return history
        })
      )
      
      // Return in vendor format
      return NextResponse.json({
        ...orderData,
        vendor: vendorData,
        seller: sellerData || {},
        items: itemsWithDetails,
        status_history: statusHistoryWithUsers || []
      })
    }
    
    // For seller updates, use the existing logic
    const { data: completeOrder, error: fetchCompleteError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        seller:sellers!seller_id(
          id,
          full_name,
          company_name,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          business_email,
          business_phone,
          tax_id,
          website,
          email,
          phone_number
        ),
        supplier:vendors!supplier_id(
          id,
          vendor_code,
          vendor_name,
          vendor_email,
          vendor_phone,
          email,
          address,
          contact_name,
          contact_person,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          tax_id
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
      // Return the basic update data if we can't fetch the complete order
      return NextResponse.json(data)
    }

    // Fetch user details for status history
    if (completeOrder.status_history && completeOrder.status_history.length > 0) {
      const statusHistoryWithUsers = await Promise.all(
        completeOrder.status_history.map(async (history) => {
          if (!history.changed_by) return history
          
          // Try to find if it's a seller
          const { data: seller } = await supabase
            .from('sellers')
            .select('id, company_name, full_name')
            .eq('id', history.changed_by)
            .single()
          
          if (seller) {
            return { ...history, changed_by_user: { type: 'seller', name: seller.company_name || seller.full_name || 'Seller' } }
          }
          
          // Try to find if it's a vendor
          const { data: vendor } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .eq('user_id', history.changed_by)
            .single()
          
          if (vendor) {
            return { ...history, changed_by_user: { type: 'vendor', name: vendor.vendor_name } }
          }
          
          return history
        })
      )
      
      completeOrder.status_history = statusHistoryWithUsers
    }

    console.log('PATCH returning complete order:', {
      id: completeOrder.id,
      status: completeOrder.status,
      status_history_count: completeOrder.status_history?.length || 0
    })

    return NextResponse.json(completeOrder)
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
          vendor_email,
          vendor_phone,
          email,
          address,
          contact_name,
          contact_person,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country,
          tax_id
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