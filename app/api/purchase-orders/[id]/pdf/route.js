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

    // Use dynamic import for pdfmake to avoid build issues
    const pdfMake = (await import('pdfmake/build/pdfmake')).default
    const pdfFonts = (await import('pdfmake/build/vfs_fonts')).default
    pdfMake.vfs = pdfFonts.pdfMake.vfs

    // Create table body for items
    const tableBody = [
      [
        { text: 'SKU', style: 'tableHeader' },
        { text: 'Product', style: 'tableHeader' },
        { text: 'Quantity', style: 'tableHeader', alignment: 'right' },
        { text: 'UOM', style: 'tableHeader' },
        { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' }
      ]
    ]

    // Add items to table
    ;(items || []).forEach(item => {
      tableBody.push([
        item.product.sku,
        item.product.product_name,
        { text: item.quantity.toString(), alignment: 'right' },
        item.product.unit_of_measure || 'units',
        { text: `$${item.unit_price.toFixed(2)}`, alignment: 'right' },
        { text: `$${(item.quantity * item.unit_price).toFixed(2)}`, alignment: 'right' }
      ])
    })

    // Build content array
    const content = [
      // Header
      { text: 'PURCHASE ORDER', style: 'header', alignment: 'center' },
      { text: `PO Number: ${order.po_number}`, alignment: 'center', margin: [0, 5] },
      { text: `Date: ${new Date(order.created_at).toLocaleDateString()}`, alignment: 'center' },
      { text: `Status: ${order.status.replace(/_/g, ' ').toUpperCase()}`, alignment: 'center' },
    ]
    
    if (order.trade_terms) {
      content.push({ text: `Trade Terms: ${order.trade_terms}`, alignment: 'center' })
    }
    
    content.push(
      // Separator
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2 }], margin: [0, 20] },
      
      // Buyer and Supplier info
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'FROM (BUYER)', style: 'subheader' },
              { text: seller?.company_name || 'Company Name', bold: true, margin: [0, 5] },
              ...(seller?.address ? [{ text: seller.address }] : []),
              ...(seller?.email ? [{ text: `Email: ${seller.email}` }] : []),
              ...(seller?.phone_number ? [{ text: `Phone: ${seller.phone_number}` }] : [])
            ]
          },
          {
            width: '50%',
            stack: [
              { text: 'TO (SUPPLIER)', style: 'subheader' },
              { text: supplier?.vendor_name || 'Unknown Supplier', bold: true, margin: [0, 5] },
              ...(supplier?.address ? [{ text: supplier.address }] : []),
              ...(supplier?.email ? [{ text: `Email: ${supplier.email}` }] : []),
              ...(supplier?.contact_name ? [{ text: `Contact: ${supplier.contact_name}` }] : []),
              ...(supplier?.vendor_phone ? [{ text: `Phone: ${supplier.vendor_phone}` }] : [])
            ]
          }
        ],
        margin: [0, 0, 0, 30]
      },
      
      // Items table
      {
        table: {
          headerRows: 1,
          widths: ['15%', '35%', '12%', '13%', '12%', '13%'],
          body: tableBody
        },
        layout: {
          fillColor: function (rowIndex) {
            return (rowIndex === 0) ? '#f0f0f0' : null
          },
          hLineWidth: function (i, node) {
            return (i === 0 || i === 1 || i === node.table.body.length) ? 2 : 1
          },
          vLineWidth: function () {
            return 0
          },
          hLineColor: function (i, node) {
            return (i === 0 || i === 1 || i === node.table.body.length) ? '#333' : '#ddd'
          },
          paddingTop: function () {
            return 8
          },
          paddingBottom: function () {
            return 8
          }
        }
      },
      
      // Totals
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            stack: [
              { 
                columns: [
                  { text: 'Subtotal:', alignment: 'right' },
                  { text: `$${(order.subtotal || 0).toFixed(2)}`, alignment: 'right', width: 80 }
                ],
                margin: [0, 20, 0, 5]
              },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 2 }] },
              { 
                columns: [
                  { text: 'Total:', bold: true, fontSize: 14, alignment: 'right' },
                  { text: `$${(order.total_amount || 0).toFixed(2)}`, bold: true, fontSize: 14, alignment: 'right', width: 80 }
                ],
                margin: [0, 10, 0, 0]
              }
            ]
          }
        ]
      }
    )
    
    // Add notes if present
    if (order.notes) {
      content.push({
        stack: [
          { text: 'Notes:', style: 'subheader', margin: [0, 40, 0, 10] },
          { 
            text: order.notes, 
            fillColor: '#f9f9f9',
            margin: [10, 10]
          }
        ]
      })
    }
    
    // Footer
    content.push({
      text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
      alignment: 'center',
      fontSize: 10,
      color: '#666',
      margin: [0, 60, 0, 0]
    })

    // Define document definition
    const docDefinition = {
      content: content,
      styles: {
        header: {
          fontSize: 24,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 14,
          bold: true,
          margin: [0, 0, 0, 5]
        },
        tableHeader: {
          bold: true,
          fontSize: 12,
          color: 'black'
        }
      },
      defaultStyle: {
        fontSize: 11
      }
    }

    // Generate PDF
    const pdfDoc = pdfMake.createPdf(docDefinition)
    
    // Get PDF buffer
    const chunks = []
    const pdfStream = pdfDoc.getStream()
    
    return new Promise((resolve) => {
      pdfStream.on('data', (chunk) => {
        chunks.push(chunk)
      })
      
      pdfStream.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks)
        
        resolve(new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="PO-${order.po_number}.pdf"`
          }
        }))
      })
      
      pdfStream.end()
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}