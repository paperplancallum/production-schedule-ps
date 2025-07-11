'use client'

import { useState, useEffect } from 'react'
import { FileText, Plus, Eye, MoreVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'
import CreatePurchaseOrderDialog from '@/app/seller/purchase-orders/create-purchase-order-dialog'

const statusConfig = {
  draft: { label: 'Draft', color: 'secondary' },
  sent_to_supplier: { label: 'Sent To Supplier', color: 'blue' },
  approved: { label: 'Approved', color: 'green' },
  in_progress: { label: 'In Progress', color: 'yellow' },
  complete: { label: 'Complete', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'destructive' }
}

export default function PurchaseOrdersTable({ vendorId }) {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

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

  const handleCreateWithVendor = () => {
    // Open dialog with pre-selected vendor
    setCreateDialogOpen(true)
  }

  const handleViewOrder = (orderId) => {
    router.push(`/seller/purchase-orders/${orderId}`)
  }

  return (
    <>
      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Purchase Orders</h3>
            <Button onClick={handleCreateWithVendor}>
              <Plus className="h-4 w-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading purchase orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
              <FileText className="h-12 w-12" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No purchase orders yet
            </h3>
            <p className="text-sm text-gray-500">
              Create your first purchase order to get started
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.po_number}</TableCell>
                  <TableCell>{formatDate(order.order_date)}</TableCell>
                  <TableCell>{formatDate(order.requested_delivery_date)}</TableCell>
                  <TableCell>{order.items?.length || 0}</TableCell>
                  <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[order.status]?.color}>
                      {statusConfig[order.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewOrder(order.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreatePurchaseOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => loadOrders()}
        defaultSupplierId={vendorId}
      />
    </>
  )
}