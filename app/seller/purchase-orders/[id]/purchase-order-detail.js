'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  Download, 
  Mail, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  Calendar,
  User,
  Building,
  Phone,
  MapPin,
  DollarSign,
  Hash,
  Edit,
  Clock,
  AlertCircle,
  ArrowDownToLine,
  ClipboardCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import jsPDF from 'jspdf'
import EditPurchaseOrderDialog from './edit-purchase-order-dialog'
import { toast } from 'sonner'

export default function PurchaseOrderDetail({ order: initialOrder }) {
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [hasTransfer, setHasTransfer] = useState(false)
  const [checkingTransfer, setCheckingTransfer] = useState(true)
  const [inspectionRequired, setInspectionRequired] = useState(order.inspection_required !== false)

  const statusConfig = {
    draft: { label: 'Draft', color: 'secondary', icon: FileText },
    sent_to_supplier: { label: 'Sent To Supplier', color: 'blue', icon: Mail },
    approved: { label: 'Approved', color: 'green', icon: CheckCircle },
    in_progress: { label: 'In Production', color: 'yellow', icon: Package },
    complete: { label: 'Complete', color: 'green', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'destructive', icon: XCircle }
  }

  useEffect(() => {
    checkForTransfer()
  }, [order.id])

  const checkForTransfer = async () => {
    try {
      const response = await fetch('/api/transfers')
      const data = await response.json()
      
      if (response.ok) {
        const existingTransfer = data.find(t => t.purchase_order_id === order.id)
        setHasTransfer(!!existingTransfer)
      }
    } catch (error) {
      console.error('Error checking for transfer:', error)
    } finally {
      setCheckingTransfer(false)
    }
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleStatusUpdate = async (newStatus) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        // Status update was successful
        toast.success('Status updated successfully')
        
        // Reload the page to get fresh data with all relations
        setTimeout(() => {
          window.location.reload()
        }, 500) // Small delay to ensure toast is visible
      } else {
        const error = await response.json()
        toast.error(`Error updating status: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this purchase order?')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Purchase order deleted')
        router.push('/seller/purchase-orders')
      } else {
        const error = await response.json()
        toast.error(`Error deleting order: ${error.error}`)
      }
    } catch (error) {
      console.error('Error deleting order:', error)
      toast.error('Failed to delete order')
    } finally {
      setLoading(false)
    }
  }

  const getNextStatuses = () => {
    const transitions = {
      'draft': [], // Remove sent_to_supplier - will be set automatically when emailing
      'sent_to_supplier': [], // Only vendor can approve, seller must wait
      'approved': ['in_progress'],
      'in_progress': ['complete'],
      'complete': [],
      'cancelled': []
    }
    return transitions[order.status] || []
  }

  const canBeCancelled = () => {
    const cancellableStatuses = ['draft', 'sent_to_supplier', 'approved', 'in_progress']
    return cancellableStatuses.includes(order.status)
  }

  const handleDownloadPDF = async () => {
    setLoading(true)
    try {
      const pdf = new jsPDF()
      
      // Set up the document
      pdf.setFontSize(20)
      pdf.text('PURCHASE ORDER', 105, 20, { align: 'center' })
      
      pdf.setFontSize(12)
      pdf.text(`PO Number: ${order.po_number}`, 105, 30, { align: 'center' })
      pdf.text(`Date: ${formatDate(order.created_at)}`, 105, 38, { align: 'center' })
      pdf.text(`Status: ${order.status.replace(/_/g, ' ').toUpperCase()}`, 105, 46, { align: 'center' })
      if (order.trade_terms) {
        pdf.text(`Trade Terms: ${order.trade_terms}`, 105, 54, { align: 'center' })
      }
      
      // Add a line
      pdf.setLineWidth(0.5)
      pdf.line(20, 60, 190, 60)
      
      // Buyer and Supplier info side by side
      let yPos = 70
      
      // Buyer (Seller) info - Left side
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text('FROM (BUYER)', 20, yPos)
      
      pdf.setFontSize(11)
      pdf.setFont(undefined, 'normal')
      yPos += 8
      
      const seller = order.seller || {}
      pdf.text(seller.company_name || seller.full_name || 'Buyer Name', 20, yPos)
      yPos += 6
      
      // Address
      if (seller.address_line1) {
        pdf.text(seller.address_line1, 20, yPos)
        yPos += 6
        if (seller.address_line2) {
          pdf.text(seller.address_line2, 20, yPos)
          yPos += 6
        }
        const cityStateZip = [seller.city, seller.state, seller.zip_code].filter(Boolean).join(', ')
        if (cityStateZip) {
          pdf.text(cityStateZip, 20, yPos)
          yPos += 6
        }
        if (seller.country) {
          pdf.text(seller.country, 20, yPos)
          yPos += 6
        }
      }
      
      // Contact info
      if (seller.business_email || seller.email) {
        pdf.text(`Email: ${seller.business_email || seller.email}`, 20, yPos)
        yPos += 6
      }
      if (seller.business_phone || seller.phone_number) {
        pdf.text(`Phone: ${seller.business_phone || seller.phone_number}`, 20, yPos)
        yPos += 6
      }
      if (seller.tax_id) {
        pdf.text(`Tax ID: ${seller.tax_id}`, 20, yPos)
      }
      
      // Supplier (Vendor) info - Right side
      yPos = 70
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text('TO (SUPPLIER)', 110, yPos)
      
      pdf.setFontSize(11)
      pdf.setFont(undefined, 'normal')
      yPos += 8
      
      const supplier = order.supplier || {}
      pdf.text(supplier.vendor_name || supplier.name || 'Supplier Name', 110, yPos)
      yPos += 6
      
      // Vendor Address - check both structured fields and legacy address field
      if (supplier.address_line1) {
        pdf.text(supplier.address_line1, 110, yPos)
        yPos += 6
        if (supplier.address_line2) {
          pdf.text(supplier.address_line2, 110, yPos)
          yPos += 6
        }
        const vendorCityStateZip = [supplier.city, supplier.state, supplier.zip_code].filter(Boolean).join(', ')
        if (vendorCityStateZip) {
          pdf.text(vendorCityStateZip, 110, yPos)
          yPos += 6
        }
        if (supplier.country) {
          pdf.text(supplier.country, 110, yPos)
          yPos += 6
        }
      } else if (supplier.address) {
        // Fall back to legacy address field if structured fields are empty
        pdf.text(supplier.address, 110, yPos)
        yPos += 6
        if (supplier.country) {
          pdf.text(supplier.country, 110, yPos)
          yPos += 6
        }
      }
      
      // Vendor Contact info
      if (supplier.email) {
        pdf.text(`Email: ${supplier.email}`, 110, yPos)
        yPos += 6
      }
      if (supplier.contact_person || supplier.contact_name) {
        pdf.text(`Contact: ${supplier.contact_person || supplier.contact_name}`, 110, yPos)
        yPos += 6
      }
      if (supplier.tax_id) {
        pdf.text(`Tax ID: ${supplier.tax_id}`, 110, yPos)
      }
      
      // Items table - adjust position based on how much space the addresses took
      yPos = Math.max(yPos + 15, 140)
      pdf.setFontSize(12)
      pdf.setFont(undefined, 'bold')
      
      // Table headers
      pdf.text('SKU', 20, yPos)
      pdf.text('Product', 45, yPos)
      pdf.text('Qty', 110, yPos)
      pdf.text('UOM', 125, yPos)
      pdf.text('Unit Price', 145, yPos)
      pdf.text('Total', 175, yPos)
      
      pdf.line(20, yPos + 2, 190, yPos + 2)
      
      // Table rows
      pdf.setFont(undefined, 'normal')
      yPos += 8
      
      let subtotal = 0
      ;(order.items || []).forEach(item => {
        const product = item.product || {}
        const lineTotal = item.quantity * item.unit_price
        subtotal += lineTotal
        
        pdf.text(product.sku || '', 20, yPos)
        pdf.text(product.product_name || '', 45, yPos)
        pdf.text(item.quantity.toString(), 110, yPos)
        pdf.text(product.unit_of_measure || 'units', 125, yPos)
        pdf.text(`$${item.unit_price.toFixed(2)}`, 145, yPos)
        pdf.text(`$${lineTotal.toFixed(2)}`, 175, yPos)
        
        yPos += 8
      })
      
      // Totals
      pdf.line(140, yPos, 190, yPos)
      yPos += 8
      pdf.text('Subtotal:', 140, yPos)
      pdf.text(`$${(order.subtotal || subtotal).toFixed(2)}`, 175, yPos)
      
      yPos += 8
      pdf.setFont(undefined, 'bold')
      pdf.text('Total:', 140, yPos)
      pdf.text(`$${(order.total_amount || subtotal).toFixed(2)}`, 175, yPos)
      
      // Notes
      if (order.notes) {
        yPos += 20
        pdf.setFont(undefined, 'bold')
        pdf.text('Notes:', 20, yPos)
        pdf.setFont(undefined, 'normal')
        yPos += 8
        
        // Split notes into lines if too long
        const lines = pdf.splitTextToSize(order.notes, 170)
        lines.forEach(line => {
          pdf.text(line, 20, yPos)
          yPos += 6
        })
      }
      
      // Footer
      pdf.setFontSize(10)
      pdf.setTextColor(128)
      pdf.text(`Generated on ${formatDateTime(new Date())}`, 105, 280, { align: 'center' })
      
      // Save the PDF
      pdf.save(`PO-${order.po_number}.pdf`)
      toast.success('PDF downloaded successfully')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    // First confirmation
    if (!confirm('Are you sure you want to cancel this purchase order?')) {
      return
    }
    
    // Second confirmation
    if (!confirm('This action cannot be undone. Are you absolutely sure?')) {
      return
    }
    
    await handleStatusUpdate('cancelled')
  }

  const handleReceiveInventory = () => {
    // Navigate to transfers page with this PO for instant transfer
    router.push(`/seller/transfers?create=true&type=in&po=${encodeURIComponent(order.po_number)}&instant=true`)
  }

  const canReceiveInventory = () => {
    // Can receive if: not already transferred, and status is approved, in_progress, or complete
    return !hasTransfer && !checkingTransfer && 
           (order.status === 'approved' || order.status === 'in_progress' || order.status === 'complete')
  }

  const handleToggleInspectionRequired = async () => {
    setLoading(true)
    try {
      const newValue = !inspectionRequired
      
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inspection_required: newValue })
      })

      if (response.ok) {
        setInspectionRequired(newValue)
        setOrder(prev => ({ ...prev, inspection_required: newValue }))
        toast.success(`Inspection ${newValue ? 'required' : 'not required'} for this order`)
      } else {
        const error = await response.json()
        toast.error(`Error updating inspection requirement: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating inspection requirement:', error)
      toast.error('Failed to update inspection requirement')
    } finally {
      setLoading(false)
    }
  }

  const canToggleInspection = () => {
    // Can toggle if order is not complete or cancelled
    return order.status !== 'complete' && order.status !== 'cancelled'
  }

  const StatusIcon = statusConfig[order.status]?.icon || FileText
  const nextStatuses = getNextStatuses()

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/seller/purchase-orders" 
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Purchase Orders
        </Link>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Purchase Order {order.po_number}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={statusConfig[order.status]?.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig[order.status]?.label}
              </Badge>
              <span className="text-gray-500">
                Created on {formatDate(order.created_at)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            {order.status === 'draft' && (
              <>
                <Button variant="outline" onClick={() => setEditDialogOpen(true)} disabled={loading}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Order
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Delete
                </Button>
              </>
            )}
            <Button variant="outline" onClick={handleDownloadPDF} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            {canToggleInspection() && (
              <Button 
                variant={inspectionRequired ? "outline" : "secondary"}
                onClick={handleToggleInspectionRequired} 
                disabled={loading}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                {inspectionRequired ? 'Inspection Not Required' : 'Inspection Required'}
              </Button>
            )}
            {canReceiveInventory() && (
              <Button 
                onClick={handleReceiveInventory} 
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                <ArrowDownToLine className="h-4 w-4 mr-2" />
                Receive into Inventory
              </Button>
            )}
            {hasTransfer && (
              <Badge variant="green" className="flex items-center gap-1 px-3 py-2">
                <CheckCircle className="h-4 w-4" />
                Inventory Received
              </Badge>
            )}
            {order.status === 'draft' && (
              <Button onClick={() => handleStatusUpdate('sent_to_supplier')} disabled={loading}>
                <Mail className="h-4 w-4 mr-2" />
                Send PO to Supplier
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2">SKU</th>
                      <th className="text-left py-3 px-2">Product</th>
                      <th className="text-right py-3 px-2">Quantity</th>
                      <th className="text-right py-3 px-2">Unit Price</th>
                      <th className="text-right py-3 px-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items?.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 px-2 text-sm">{item.product?.sku}</td>
                        <td className="py-3 px-2">
                          <div>
                            <div className="font-medium">{item.product?.product_name}</div>
                            {item.product?.description && (
                              <div className="text-sm text-gray-500">{item.product.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right">{item.quantity}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="py-3 px-2 text-right font-medium">Subtotal:</td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatCurrency(order.subtotal || 0)}
                      </td>
                    </tr>
                    <tr className="border-t-2">
                      <td colSpan="4" className="py-3 px-2 text-right font-bold text-lg">Total:</td>
                      <td className="py-3 px-2 text-right font-bold text-lg">
                        {formatCurrency(order.total_amount || 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          {console.log('Rendering status history, order:', order, 'status_history:', order.status_history)}
          {order.status_history && order.status_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Status History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.status_history.map((history, index) => {
                    const isDateChange = history.notes?.includes('Goods ready date')
                    
                    return (
                      <div key={history.id} className="border-l-2 border-gray-200 pl-4 pb-4 last:border-0">
                        <div className="relative">
                          <div className="absolute -left-6 top-0 w-3 h-3 bg-white border-2 border-gray-400 rounded-full"></div>
                          <div className="flex items-center gap-2 mb-1">
                            {isDateChange ? (
                              <Badge variant="secondary" className="text-xs">
                                <Calendar className="h-3 w-3 mr-1" />
                                Date Updated
                              </Badge>
                            ) : (
                              <>
                                <Badge variant={statusConfig[history.to_status]?.color} className="text-xs">
                                  {statusConfig[history.to_status]?.label}
                                </Badge>
                                {history.from_status && history.from_status !== history.to_status && (
                                  <span className="text-xs text-gray-500">
                                    from {statusConfig[history.from_status]?.label || history.from_status.replace(/_/g, ' ')}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatDateTime(history.created_at)}
                            {history.changed_by_user && (
                              <span className="ml-2">
                                by {history.changed_by_user.name}
                              </span>
                            )}
                          </p>
                          {history.notes && (
                            <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Order Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Inspection Status */}
              <div className="pb-4 border-b">
                <p className="text-sm text-gray-500 mb-2">Inspection Status</p>
                {!inspectionRequired ? (
                  <Badge variant="secondary" className="flex items-center gap-1 w-full justify-center py-2">
                    <XCircle className="h-4 w-4" />
                    Not Required
                  </Badge>
                ) : (
                  <Badge variant="blue" className="flex items-center gap-1 w-full justify-center py-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Required
                  </Badge>
                )}
                {canToggleInspection() && (
                  <Button 
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={handleToggleInspectionRequired}
                    disabled={loading}
                  >
                    {inspectionRequired ? 'Mark as Not Required' : 'Mark as Required'}
                  </Button>
                )}
              </div>

              {/* Transfer Status */}
              {(hasTransfer || canReceiveInventory()) && (
                <div className="pb-4 border-b">
                  <p className="text-sm text-gray-500 mb-2">Inventory Status</p>
                  {hasTransfer ? (
                    <Badge variant="green" className="flex items-center gap-1 w-full justify-center py-2">
                      <CheckCircle className="h-4 w-4" />
                      Transferred to Inventory
                    </Badge>
                  ) : canReceiveInventory() ? (
                    <Button 
                      onClick={handleReceiveInventory} 
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <ArrowDownToLine className="h-4 w-4 mr-2" />
                      Receive into Inventory
                    </Button>
                  ) : null}
                </div>
              )}
              {nextStatuses.length > 0 && (
                <div>
                  <Label>Update Status</Label>
                  <Select 
                    value={order.status} 
                    onValueChange={handleStatusUpdate}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={order.status} disabled>
                        {statusConfig[order.status]?.label} (Current)
                      </SelectItem>
                      {nextStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {statusConfig[status]?.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {canBeCancelled() && (
                <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleCancelOrder}
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Order
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Supplier Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{order.supplier?.vendor_name || 'Unknown Supplier'}</p>
              </div>
              {order.supplier?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{order.supplier.email}</p>
                </div>
              )}
              {order.supplier?.contact_name && (
                <div>
                  <p className="text-sm text-gray-500">Contact Person</p>
                  <p className="font-medium">{order.supplier.contact_name}</p>
                </div>
              )}
              {order.supplier?.address && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{order.supplier.address}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">PO Number</p>
                <p className="font-medium">{order.po_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Order Date</p>
                <p className="font-medium">{formatDate(order.created_at)}</p>
              </div>
              {order.trade_terms && (
                <div>
                  <p className="text-sm text-gray-500">Trade Terms</p>
                  <p className="font-medium">{order.trade_terms}</p>
                </div>
              )}
              {order.goods_ready_date && (
                <div>
                  <p className="text-sm text-gray-500">
                    Goods Ready Date
                    {order.status === 'draft' && (
                      <span className="text-xs text-gray-400 ml-1">
                        (calculated)
                      </span>
                    )}
                  </p>
                  <p className="font-medium">{formatDate(order.goods_ready_date)}</p>
                </div>
              )}
              {order.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="font-medium">{order.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditPurchaseOrderDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        order={order}
        onSuccess={(updatedOrder) => {
          setOrder(updatedOrder)
          router.refresh()
        }}
      />
    </div>
  )
}