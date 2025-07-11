'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, FileText, Package, Truck, CheckCircle, XCircle, Clock, ClipboardCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import CreatePurchaseOrderDialog from './create-purchase-order-dialog'
import ScheduleInspectionDialog from './schedule-inspection-dialog'
import { useRouter } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

const statusConfig = {
  draft: { label: 'Draft', color: 'secondary', icon: FileText },
  sent_to_supplier: { label: 'Sent To Supplier', color: 'blue', icon: Clock },
  approved: { label: 'Approved', color: 'green', icon: CheckCircle },
  in_progress: { label: 'In Production', color: 'yellow', icon: Package },
  complete: { label: 'Complete', color: 'green', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'destructive', icon: XCircle }
}

export default function PurchaseOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
  const [inspectionData, setInspectionData] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    completed: 0
  })

  useEffect(() => {
    loadPurchaseOrders()
  }, [statusFilter])

  const loadPurchaseOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/purchase-orders?${params}`)
      const data = await response.json()

      if (response.ok) {
        // Ensure we have goods_ready_date for each order
        const ordersWithDates = data.map(order => ({
          ...order,
          goods_ready_date: order.goods_ready_date || order.requested_delivery_date
        }))
        setOrders(ordersWithDates)
        calculateStats(ordersWithDates)
      } else {
        console.error('Error loading purchase orders:', data.error)
      }
    } catch (error) {
      console.error('Error loading purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (orderData) => {
    const stats = {
      total: orderData.length,
      draft: orderData.filter(o => o.status === 'draft').length,
      pending: orderData.filter(o => ['sent_to_supplier', 'approved', 'in_progress'].includes(o.status)).length,
      completed: orderData.filter(o => o.status === 'complete').length
    }
    setStats(stats)
  }

  const filteredOrders = orders.filter(order => {
    const companyName = order.supplier?.vendor_name || ''
    const matchesSearch = !searchTerm || 
      order.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companyName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

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

  const handleRowClick = (orderId) => {
    router.push(`/seller/purchase-orders/${orderId}`)
  }

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId])
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId))
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id))
    } else {
      setSelectedOrders([])
    }
  }

  const prepareInspectionData = () => {
    const selectedOrderData = orders.filter(order => selectedOrders.includes(order.id))
    
    // Group by supplier
    const supplierGroups = selectedOrderData.reduce((groups, order) => {
      const supplierId = order.supplier_id
      if (!groups[supplierId]) {
        groups[supplierId] = {
          supplier: order.supplier,
          orders: [],
          latestGoodsReadyDate: null
        }
      }
      groups[supplierId].orders.push(order)
      
      // Update latest goods ready date
      const orderDate = order.goods_ready_date || order.requested_delivery_date
      if (orderDate && (!groups[supplierId].latestGoodsReadyDate || 
          new Date(orderDate) > new Date(groups[supplierId].latestGoodsReadyDate))) {
        groups[supplierId].latestGoodsReadyDate = orderDate
      }
      
      return groups
    }, {})
    
    return Object.values(supplierGroups)
  }

  const handleScheduleInspection = () => {
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one purchase order')
      return
    }
    
    const inspectionGroups = prepareInspectionData()
    setInspectionData(inspectionGroups)
    setInspectionDialogOpen(true)
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Purchase Orders
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Manage your purchase orders
            </p>
          </div>
          <div className="flex gap-2">
            {selectedOrders.length > 0 && (
              <Button
                variant="outline"
                onClick={handleScheduleInspection}
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Schedule Inspection ({selectedOrders.length})
              </Button>
            )}
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Purchase Order
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Draft</CardDescription>
            <CardTitle className="text-2xl">{stats.draft}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by PO number or supplier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(statusConfig).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>PO Number</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Goods Ready</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading purchase orders...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center">
                    <FileText className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-gray-500">No purchase orders found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      Create your first order
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => {
                const StatusIcon = statusConfig[order.status]?.icon || FileText
                return (
                  <TableRow
                    key={order.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={(checked) => handleSelectOrder(order.id, checked)}
                        aria-label={`Select ${order.po_number}`}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-medium cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {order.po_number}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {order.supplier?.vendor_name || 'Unknown'}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {formatDate(order.order_date)}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {formatDate(order.goods_ready_date)}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {order.items?.length || 0}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      {formatCurrency(order.total_amount)}
                    </TableCell>
                    <TableCell 
                      className="cursor-pointer"
                      onClick={() => handleRowClick(order.id)}
                    >
                      <Badge variant={statusConfig[order.status]?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[order.status]?.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <CreatePurchaseOrderDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => loadPurchaseOrders()}
      />
      
      <ScheduleInspectionDialog
        open={inspectionDialogOpen}
        onOpenChange={setInspectionDialogOpen}
        inspectionGroups={inspectionData}
        onSuccess={() => {
          setSelectedOrders([])
          loadPurchaseOrders()
          toast.success('Inspection(s) scheduled successfully')
        }}
      />
    </div>
  )
}