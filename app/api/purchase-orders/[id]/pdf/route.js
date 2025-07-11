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

    // Fetch purchase order
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Check if user owns this order
    if (order.seller_id !== user.id) {
      // Check if user is the supplier
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('id', order.supplier_id)
        .eq('user_id', user.id)
        .single()

      if (!vendor) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Fetch supplier details
    const { data: supplier } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', order.supplier_id)
      .single()

    // Fetch seller details
    const { data: seller } = await supabase
      .from('sellers')
      .select('*')
      .eq('id', order.seller_id)
      .single()

    // Fetch order items
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select(`
        *,
        product:products(*)
      `)
      .eq('purchase_order_id', order.id)

    // Generate HTML content
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${order.po_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { margin: 0; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .info-box { width: 45%; }
    .info-box h3 { margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .totals { text-align: right; margin-top: 20px; }
    .notes { margin-top: 40px; }
    @media print {
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PURCHASE ORDER</h1>
    <p>PO Number: ${order.po_number}</p>
    <p>Date: ${new Date(order.created_at).toLocaleDateString()}</p>
    <p>Status: ${order.status.replace(/_/g, ' ').toUpperCase()}</p>
    ${order.trade_terms ? `<p>Trade Terms: ${order.trade_terms}</p>` : ''}
  </div>

  <div class="info-section">
    <div class="info-box">
      <h3>FROM:</h3>
      <p><strong>${seller?.company_name || 'Company Name'}</strong></p>
      ${seller?.address ? `<p>${seller.address}</p>` : ''}
      ${seller?.email ? `<p>${seller.email}</p>` : ''}
      ${seller?.phone_number ? `<p>${seller.phone_number}</p>` : ''}
    </div>
    <div class="info-box">
      <h3>TO:</h3>
      <p><strong>${supplier?.vendor_name || 'Unknown Supplier'}</strong></p>
      ${supplier?.address ? `<p>${supplier.address}</p>` : ''}
      ${supplier?.email ? `<p>${supplier.email}</p>` : ''}
      ${supplier?.contact_name ? `<p>Contact: ${supplier.contact_name}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product</th>
        <th>Quantity</th>
        <th>UOM</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${(items || []).map(item => `
        <tr>
          <td>${item.product.sku}</td>
          <td>${item.product.product_name}</td>
          <td>${item.quantity}</td>
          <td>${item.product.unit_of_measure || 'units'}</td>
          <td>$${item.unit_price.toFixed(2)}</td>
          <td>$${(item.quantity * item.unit_price).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <p>Subtotal: $${(order.subtotal || 0).toFixed(2)}</p>
    <p><strong>Total: $${(order.total_amount || 0).toFixed(2)}</strong></p>
  </div>

  ${order.notes ? `
  <div class="notes">
    <h3>Notes:</h3>
    <p>${order.notes}</p>
  </div>
  ` : ''}

  <div style="margin-top: 60px; text-align: center; color: #666;">
    <p>Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>
    `

    // Return HTML with appropriate headers for download
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="PO-${order.po_number}.html"`
      }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}