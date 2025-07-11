'use client'

import { useState, useEffect } from 'react'
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
  MapPin,
  Info
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { vendorStatusConfig, getVendorStatus, getSellerStatus, getVendorStatusTransitions } from '@/lib/vendor-status-mapping'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

export default function VendorPurchaseOrderDetail({ order: initialOrder }) {
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [loading, setLoading] = useState(false)
  const [goodsReadyDate, setGoodsReadyDate] = useState('')
  
  // Calculate default goods ready date on component mount
  useEffect(() => {
    if (order.goods_ready_date) {
      // If already set, use existing date
      setGoodsReadyDate(order.goods_ready_date)
    } else {
      // Calculate based on order date + longest lead time
      const orderDate = new Date(order.created_at)
      const leadTimes = order.items?.map(item => item.lead_time_days || 0) || []
      const maxLeadTime = Math.max(...leadTimes, 0)
      
      const calculatedDate = new Date(orderDate)
      calculatedDate.setDate(calculatedDate.getDate() + maxLeadTime)
      
      // Format as YYYY-MM-DD for input
      const formattedDate = calculatedDate.toISOString().split('T')[0]
      setGoodsReadyDate(formattedDate)
    }
  }, [order])

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
      
      const updateData = { status: sellerStatus }
      
      // If approving, also set the goods ready date
      if (newVendorStatus === 'approved' && vendorStatus === 'to_approve') {
        updateData.goods_ready_date = goodsReadyDate
      }
      
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        console.log('Vendor - Updated order from PATCH:', updatedOrder)
        console.log('Vendor - Status history:', updatedOrder.status_history)
        // The PATCH endpoint now returns the complete order with status history
        setOrder(updatedOrder)
        toast.success('Status updated successfully')
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

  const handleGoodsReadyDateUpdate = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ goods_ready_date: goodsReadyDate })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        console.log('Vendor - Updated order from goods ready date PATCH:', updatedOrder)
        console.log('Vendor - Status history after date update:', updatedOrder.status_history)
        // The PATCH endpoint now returns the complete order with status history
        setOrder(updatedOrder)
        toast.success('Goods ready date updated successfully')
      } else {
        const error = await response.json()
        toast.error(`Error updating goods ready date: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating goods ready date:', error)
      toast.error('Failed to update goods ready date')
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
      
      const vendor = order.vendor || {}
      pdf.text(vendor.vendor_name || 'Supplier Name', 110, yPos)
      yPos += 6
      
      // Vendor Address
      if (vendor.address_line1) {
        pdf.text(vendor.address_line1, 110, yPos)
        yPos += 6
        if (vendor.address_line2) {
          pdf.text(vendor.address_line2, 110, yPos)
          yPos += 6
        }
        const vendorCityStateZip = [vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')
        if (vendorCityStateZip) {
          pdf.text(vendorCityStateZip, 110, yPos)
          yPos += 6
        }
        if (vendor.country) {
          pdf.text(vendor.country, 110, yPos)
          yPos += 6
        }
      }
      
      // Vendor Contact info
      if (vendor.email) {
        pdf.text(`Email: ${vendor.email}`, 110, yPos)
        yPos += 6
      }
      if (vendor.contact_person) {
        pdf.text(`Contact: ${vendor.contact_person}`, 110, yPos)
        yPos += 6
      }
      if (vendor.tax_id) {
        pdf.text(`Tax ID: ${vendor.tax_id}`, 110, yPos)
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
          {console.log('Vendor - Checking status history render:', {
            has_status_history: !!order.status_history,
            status_history_length: order.status_history?.length || 0,
            should_render: order.status_history && order.status_history.length > 0
          })}
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
                              <Badge variant={vendorStatusConfig[toVendorStatus]?.color} className="text-xs">
                                {vendorStatusConfig[toVendorStatus]?.label}
                              </Badge>
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
                <>
                  <div className="space-y-3 border rounded-lg p-4 bg-blue-50">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <Label className="text-sm font-semibold text-blue-900">Goods Ready Date</Label>
                        <p className="text-xs text-blue-700 mt-1">
                          This date is calculated based on the order date plus the longest lead time 
                          ({Math.max(...(order.items?.map(item => item.lead_time_days || 0) || [0]))} days) 
                          for the items in this order. You can adjust it if needed.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={goodsReadyDate}
                        onChange={(e) => setGoodsReadyDate(e.target.value)}
                        className="flex-1"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <Button 
                        onClick={handleGoodsReadyDateUpdate}
                        disabled={loading || goodsReadyDate === order.goods_ready_date}
                        size="sm"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    Review the order details and approve to begin production.
                  </div>
                </>
              )}
              
              {(vendorStatus === 'approved' || vendorStatus === 'in_production') && (
                <div className="space-y-3">
                  <div className="border rounded-lg p-3 bg-gray-50">
                    <Label className="text-sm font-medium text-gray-700">Goods Ready Date</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="date"
                        value={goodsReadyDate}
                        onChange={(e) => setGoodsReadyDate(e.target.value)}
                        className="flex-1"
                        min={new Date().toISOString().split('T')[0]}
                      />
                      <Button 
                        onClick={handleGoodsReadyDateUpdate}
                        disabled={loading || goodsReadyDate === order.goods_ready_date}
                        size="sm"
                        variant="outline"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                  {vendorStatus === 'in_production' && (
                    <div className="text-sm text-gray-600">
                      Update status when production is finished.
                    </div>
                  )}
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
              {(order.goods_ready_date || goodsReadyDate) && (
                <div>
                  <p className="text-sm text-gray-500">Goods Ready Date</p>
                  <p className="font-medium">{formatDate(order.goods_ready_date || goodsReadyDate)}</p>
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