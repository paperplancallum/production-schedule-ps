import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
const jsPDF = require('jspdf').jsPDF
require('jspdf-autotable')

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

    // Create PDF
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(20)
    doc.text('PURCHASE ORDER', 105, 20, { align: 'center' })
    
    // PO Number and Date
    doc.setFontSize(12)
    doc.text(`PO Number: ${order.po_number}`, 20, 40)
    doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 20, 48)
    doc.text(`Status: ${order.status.replace(/_/g, ' ').toUpperCase()}`, 20, 56)
    
    // Trade Terms
    if (order.trade_terms) {
      doc.text(`Trade Terms: ${order.trade_terms}`, 20, 64)
    }
    
    // Seller Information
    doc.setFontSize(14)
    doc.text('FROM:', 20, 80)
    doc.setFontSize(11)
    doc.text(seller?.company_name || 'Company Name', 20, 88)
    if (seller?.address) doc.text(seller.address, 20, 96)
    if (seller?.email) doc.text(seller.email, 20, 104)
    if (seller?.phone_number) doc.text(seller.phone_number, 20, 112)
    
    // Supplier Information
    doc.setFontSize(14)
    doc.text('TO:', 120, 80)
    doc.setFontSize(11)
    doc.text(supplier?.vendor_name || 'Unknown Supplier', 120, 88)
    if (supplier?.address) doc.text(supplier.address, 120, 96)
    if (supplier?.email) doc.text(supplier.email, 120, 104)
    if (supplier?.contact_name) doc.text(`Contact: ${supplier.contact_name}`, 120, 112)
    
    // Items Table
    const tableData = items?.map(item => [
      item.product.sku,
      item.product.product_name,
      item.quantity.toString(),
      item.product.unit_of_measure || 'units',
      `$${item.unit_price.toFixed(2)}`,
      `$${(item.quantity * item.unit_price).toFixed(2)}`
    ]) || []
    
    doc.autoTable({
      startY: 130,
      head: [['SKU', 'Product', 'Qty', 'UOM', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 66, 66] }
    })
    
    // Totals
    const finalY = doc.lastAutoTable.finalY + 10
    doc.text(`Subtotal: $${(order.subtotal || 0).toFixed(2)}`, 140, finalY)
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text(`Total: $${(order.total_amount || 0).toFixed(2)}`, 140, finalY + 8)
    
    // Notes
    if (order.notes) {
      doc.setFont(undefined, 'normal')
      doc.setFontSize(11)
      doc.text('Notes:', 20, finalY + 20)
      doc.setFontSize(10)
      const splitNotes = doc.splitTextToSize(order.notes, 170)
      doc.text(splitNotes, 20, finalY + 28)
    }
    
    // Footer
    doc.setFontSize(9)
    doc.setTextColor(128)
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 105, 280, { align: 'center' })
    
    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    
    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${order.po_number}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generating PDF:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}