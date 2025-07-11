'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  FileText, 
  Download, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  Clock,
  Factory,
  Calendar,
  Building,
  User,
  Hash,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { vendorStatusConfig, getVendorStatus, getSellerStatus, getVendorStatusTransitions } from '@/lib/vendor-status-mapping'
import jsPDF from 'jspdf'

export default function VendorPurchaseOrderDetail({ order: initialOrder }) {
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(false)

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

  const handleStatusUpdate = async (newVendorStatus) => {
    setLoading(true)
    try {
      // Convert vendor status to seller status for database
      const sellerStatus = getSellerStatus(newVendorStatus)
      
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: sellerStatus })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrder({
          ...order,
          status: updatedOrder.status,
          updated_at: updatedOrder.updated_at
        })
      } else {
        const error = await response.json()
        alert(`Error updating status: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    } finally {
      setLoading(false)
    }
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
      pdf.text(`Status: ${vendorStatusConfig[vendorStatus]?.label}`, 105, 46, { align: 'center' })
      if (order.trade_terms) {
        pdf.text(`Trade Terms: ${order.trade_terms}`, 105, 54, { align: 'center' })
      }
      
      // Add a line
      pdf.setLineWidth(0.5)
      pdf.line(20, 60, 190, 60)
      
      // Buyer info
      let yPos = 70
      pdf.setFontSize(14)
      pdf.setFont(undefined, 'bold')
      pdf.text('FROM (BUYER)', 20, yPos)
      
      pdf.setFontSize(11)
      pdf.setFont(undefined, 'normal')
      yPos += 8
      
      const seller = order.seller || {}
      pdf.text(seller.company_name || 'Company Name', 20, yPos)
      yPos += 6
      if (seller.address) {
        pdf.text(seller.address, 20, yPos)
        yPos += 6
      }
      if (seller.email) {
        pdf.text(`Email: ${seller.email}`, 20, yPos)
        yPos += 6
      }
      if (seller.phone_number) {
        pdf.text(`Phone: ${seller.phone_number}`, 20, yPos)
      }
      
      // Items table
      yPos = 120
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
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  const vendorStatus = getVendorStatus(order.status)
  const nextStatuses = getVendorStatusTransitions(vendorStatus)
  const StatusIcon = getStatusIcon(vendorStatus)

  function getStatusIcon(status) {
    switch (status) {
      case 'to_approve':
        return Clock
      case 'approved':
        return CheckCircle
      case 'in_production':
        return Factory
      case 'production_finished':
        return Package
      case 'scheduled_for_pickup':
        return Calendar
      case 'picked_up':
        return Truck
      case 'cancelled':
        return XCircle
      default:
        return FileText
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/vendor/dashboard/purchase-orders" 
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
              <Badge variant={vendorStatusConfig[vendorStatus]?.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {vendorStatusConfig[vendorStatus]?.label}
              </Badge>
              <span className="text-gray-500">
                Received on {formatDate(order.created_at)}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownloadPDF} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
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
                      <th className="text-left py-3 px-2">UOM</th>
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
                        <td className="py-3 px-2">{item.product?.unit_of_measure || 'units'}</td>
                        <td className="py-3 px-2 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="py-3 px-2 text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5" className="py-3 px-2 text-right font-medium">Subtotal:</td>
                      <td className="py-3 px-2 text-right font-medium">
                        {formatCurrency(order.subtotal || 0)}
                      </td>
                    </tr>
                    <tr className="border-t-2">
                      <td colSpan="5" className="py-3 px-2 text-right font-bold text-lg">Total:</td>
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
                    const fromVendorStatus = history.from_status ? getVendorStatus(history.from_status) : null
                    const toVendorStatus = getVendorStatus(history.to_status)
                    
                    return (
                      <div key={history.id} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {fromVendorStatus ? (
                              <Badge variant="outline" className="text-xs">
                                {vendorStatusConfig[fromVendorStatus]?.label || 'Created'}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-500">Created</span>
                            )}
                            <span className="text-gray-500">→</span>
                            <Badge variant={vendorStatusConfig[toVendorStatus]?.color} className="text-xs">
                              {vendorStatusConfig[toVendorStatus]?.label}
                            </Badge>
                          </div>
                          {history.notes && (
                            <p className="text-sm text-gray-600 mt-1">{history.notes}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDateTime(history.created_at)}
                          </p>
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
              {nextStatuses.length > 0 && (
                <div>
                  <Label>Update Status</Label>
                  <Select 
                    value={vendorStatus} 
                    onValueChange={handleStatusUpdate}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={vendorStatus} disabled>
                        {vendorStatusConfig[vendorStatus]?.label} (Current)
                      </SelectItem>
                      {nextStatuses.map(status => {
                        const Icon = getStatusIcon(status)
                        return (
                          <SelectItem key={status} value={status}>
                            <div className="flex items-center">
                              <Icon className="h-4 w-4 mr-2" />
                              {vendorStatusConfig[status]?.label}
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {vendorStatus === 'to_approve' && (
                <div className="text-sm text-gray-600">
                  Review the order details and approve to begin production.
                </div>
              )}
              
              {vendorStatus === 'in_production' && (
                <div className="text-sm text-gray-600">
                  Update status when production is finished.
                </div>
              )}
              
              {vendorStatus === 'production_finished' && (
                <div className="text-sm text-gray-600">
                  Schedule pickup with the buyer.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Buyer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Company</p>
                <p className="font-medium">{order.seller?.company_name || 'N/A'}</p>
              </div>
              {order.seller?.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{order.seller.email}</p>
                </div>
              )}
              {order.seller?.phone_number && (
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{order.seller.phone_number}</p>
                </div>
              )}
              {order.seller?.address && (
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium">{order.seller.address}</p>
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
              {order.requested_delivery_date && (
                <div>
                  <p className="text-sm text-gray-500">Requested Delivery</p>
                  <p className="font-medium">{formatDate(order.requested_delivery_date)}</p>
                </div>
              )}
              {order.trade_terms && (
                <div>
                  <p className="text-sm text-gray-500">Trade Terms</p>
                  <p className="font-medium">{order.trade_terms}</p>
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
    </div>
  )
}