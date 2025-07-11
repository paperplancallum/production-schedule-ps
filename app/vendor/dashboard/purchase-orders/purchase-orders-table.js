'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Eye, CheckCircle, Truck, Package, Factory, Calendar, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { vendorStatusConfig, getVendorStatus, getSellerStatus, getVendorStatusTransitions } from '@/lib/vendor-status-mapping'

export default function PurchaseOrdersTable({ vendorId }) {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    loadOrders()
  }, [vendorId])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/purchase-orders?vendorId=${vendorId}`)
      const data = await response.json()

      if (response.ok) {
        setOrders(data)
      } else {
        console.error('Error loading purchase orders:', data.error)
      }
    } catch (error) {
      console.error('Error loading purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const handleStatusUpdate = async (orderId, newVendorStatus) => {
    setUpdating(orderId)
    try {
      // Convert vendor status to seller status for database update
      const sellerStatus = getSellerStatus(newVendorStatus)
      
      const response = await fetch(`/api/purchase-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: sellerStatus })
      })

      if (response.ok) {
        await loadOrders()
      } else {
        const data = await response.json()
        console.error('Error updating status:', data.error)
        alert(`Error updating status: ${data.error}`)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const handleViewOrder = (orderId) => {
    router.push(`/vendor/dashboard/purchase-orders/${orderId}`)
  }

  const getStatusIcon = (vendorStatus) => {
    switch (vendorStatus) {
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
      default:
        return FileText
    }
  }

  return (
    <Card>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Purchase Orders
          </h3>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">Loading purchase orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center">
          <div className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-4">
            <FileText className="h-12 w-12" />
          </div>
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
            No purchase orders yet
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You'll see purchase orders from your sellers here
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Requested Delivery</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const vendorStatus = getVendorStatus(order.status)
              const availableTransitions = getVendorStatusTransitions(vendorStatus)
              const isUpdating = updating === order.id
              const StatusIcon = getStatusIcon(vendorStatus)
              
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.po_number}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{formatDate(order.requested_delivery_date)}</TableCell>
                  <TableCell>{order.items?.length || 0}</TableCell>
                  <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={vendorStatusConfig[vendorStatus]?.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {vendorStatusConfig[vendorStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrder(order.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {availableTransitions.length > 0 && (
                        <Select
                          value=""
                          onValueChange={(value) => handleStatusUpdate(order.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-40" disabled={isUpdating}>
                            <SelectValue placeholder={isUpdating ? 'Updating...' : 'Update'} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTransitions.map(status => {
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
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}