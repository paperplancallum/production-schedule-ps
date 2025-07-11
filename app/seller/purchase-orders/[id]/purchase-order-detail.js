'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  ArrowLeft, 
  FileText, 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock,
  Edit,
  Save,
  X,
  Printer,
  Mail
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const statusConfig = {
  draft: { label: 'Draft', color: 'secondary', icon: FileText },
  submitted: { label: 'Submitted', color: 'blue', icon: Clock },
  accepted: { label: 'Accepted', color: 'green', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'yellow', icon: Package },
  shipped: { label: 'Shipped', color: 'purple', icon: Truck },
  delivered: { label: 'Delivered', color: 'green', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'destructive', icon: XCircle }
}

export default function PurchaseOrderDetail({ order: initialOrder }) {
  const router = useRouter()
  const [order, setOrder] = useState(initialOrder)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState(order.notes || '')

  const StatusIcon = statusConfig[order.status]?.icon || FileText

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString()
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const handleStatusUpdate = async (newStatus) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrder(updatedOrder)
        router.refresh()
      } else {
        const data = await response.json()
        console.error('Error updating status:', data.error)
      }
    } catch (error) {
      console.error('Error updating status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        setOrder(updatedOrder)
        setEditing(false)
      } else {
        const data = await response.json()
        console.error('Error updating notes:', data.error)
      }
    } catch (error) {
      console.error('Error updating notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/seller/purchase-orders')
      } else {
        const data = await response.json()
        console.error('Error deleting order:', data.error)
        alert(data.error || 'Failed to delete order')
      }
    } catch (error) {
      console.error('Error deleting order:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAvailableTransitions = () => {
    const transitions = {
      'draft': ['submitted', 'cancelled'],
      'submitted': ['cancelled'],
      'accepted': ['cancelled'],
      'in_progress': ['cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    }
    return transitions[order.status] || []
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/seller/purchase-orders')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Orders
        </Button>

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
                <Button variant="outline" onClick={() => {}} disabled={loading}>
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
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={() => {}}>
              <Mail className="h-4 w-4 mr-2" />
              Email
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product.product_name}</div>
                          {item.notes && (
                            <div className="text-sm text-gray-500">{item.notes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.product.sku}</TableCell>
                      <TableCell className="text-right">
                        {item.quantity} {item.product.unit_of_measure}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.line_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-2 text-right">
                <div className="flex justify-end gap-4">
                  <span className="text-gray-500">Subtotal:</span>
                  <span className="font-medium">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span className="text-gray-500">Tax:</span>
                  <span className="font-medium">{formatCurrency(order.tax_amount)}</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span className="text-gray-500">Shipping:</span>
                  <span className="font-medium">{formatCurrency(order.shipping_cost)}</span>
                </div>
                <div className="flex justify-end gap-4 text-lg font-semibold pt-2 border-t">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Notes</CardTitle>
                {!editing && order.status === 'draft' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Add notes for the supplier..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={loading}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNotes(order.notes || '')
                        setEditing(false)
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 whitespace-pre-wrap">
                  {order.notes || 'No notes added'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          {order.status_history && order.status_history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.status_history.map((history) => (
                    <div key={history.id} className="flex items-start gap-3 text-sm">
                      <div className="text-gray-500 min-w-[140px]">
                        {formatDate(history.created_at)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {history.from_status && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {statusConfig[history.from_status]?.label}
                              </Badge>
                              <span className="text-gray-500">→</span>
                            </>
                          )}
                          <Badge variant={statusConfig[history.to_status]?.color} className="text-xs">
                            {statusConfig[history.to_status]?.label}
                          </Badge>
                        </div>
                        {history.notes && (
                          <p className="text-gray-600 mt-1">{history.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Actions */}
          {getAvailableTransitions().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value=""
                  onValueChange={handleStatusUpdate}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Change status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableTransitions().map(status => (
                      <SelectItem key={status} value={status}>
                        {statusConfig[status]?.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm text-gray-500">Company</Label>
                <p className="font-medium">{order.supplier?.vendor_name || 'Unknown'}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Email</Label>
                <p className="font-medium">{order.supplier?.vendor_email || '-'}</p>
              </div>
              {order.supplier?.vendor_phone && (
                <div>
                  <Label className="text-sm text-gray-500">Phone</Label>
                  <p className="font-medium">{order.supplier?.vendor_phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Information */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm text-gray-500">Order Date</Label>
                <p className="font-medium">{formatDate(order.order_date)}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-500">Requested Delivery</Label>
                <p className="font-medium">{formatDate(order.requested_delivery_date)}</p>
              </div>
              {order.actual_delivery_date && (
                <div>
                  <Label className="text-sm text-gray-500">Actual Delivery</Label>
                  <p className="font-medium">{formatDate(order.actual_delivery_date)}</p>
                </div>
              )}
              {order.shipping_method && (
                <div>
                  <Label className="text-sm text-gray-500">Shipping Method</Label>
                  <p className="font-medium">{order.shipping_method}</p>
                </div>
              )}
              {order.shipping_address && (
                <div>
                  <Label className="text-sm text-gray-500">Shipping Address</Label>
                  <p className="font-medium whitespace-pre-line">
                    {order.shipping_address}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}