'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, FileText, Package, Truck, CheckCircle, XCircle, Clock, ClipboardCheck, Eye, ArrowDownToLine, ChevronRight, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import React from 'react'
import CreatePurchaseOrderDialog from './create-purchase-order-dialog'
import ScheduleInspectionDialog from './schedule-inspection-dialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState([])
  const [highlightedOrderId, setHighlightedOrderId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState([])
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false)
  const [inspectionData, setInspectionData] = useState(null)
  const [inspections, setInspections] = useState([])
  const [inspectionMode, setInspectionMode] = useState(false)
  const [transferMode, setTransferMode] = useState(false)
  const [transfers, setTransfers] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    pending: 0,
    completed: 0
  })
  const [groupBy, setGroupBy] = useState('supplier') // supplier, all, product
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [expandedOrders, setExpandedOrders] = useState(new Set()) // Track which orders have expanded details

  useEffect(() => {
    loadPurchaseOrders()
    loadInspections()
    loadTransfers()
  }, [statusFilter])

  // Handle highlight parameter
  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (highlightId) {
      setHighlightedOrderId(highlightId)
      // Clear the highlight parameter from URL after a delay
      setTimeout(() => {
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete('highlight')
        router.replace(newUrl.pathname + newUrl.search, { scroll: false })
        // Remove highlight after animation
        setTimeout(() => setHighlightedOrderId(null), 2000)
      }, 3000)
    }
  }, [searchParams, router])

  // Reload inspections and transfers when orders change
  useEffect(() => {
    if (orders.length > 0) {
      if (inspections.length === 0) {
        loadInspections()
      }
      loadTransfers()
    }
  }, [orders])

  // Reload transfers when page gains focus (e.g., after returning from transfers page)
  useEffect(() => {
    const handleFocus = () => {
      loadTransfers()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])


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

  const loadInspections = async () => {
    try {
      const supabase = createClient()
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) return

      const { data, error } = await supabase
        .from('inspections')
        .select('id, purchase_order_id, status, inspection_number')
        .eq('seller_id', userData.user.id)

      if (error) {
        console.error('Error loading inspections:', error)
      } else if (data) {
        setInspections(data)
      }
    } catch (error) {
      console.error('Error loading inspections:', error)
    }
  }

  const loadTransfers = async () => {
    try {
      const response = await fetch('/api/transfers')
      const data = await response.json()

      if (response.ok) {
        setTransfers(data)
      } else {
        console.error('Error loading transfers:', data.error)
      }
    } catch (error) {
      console.error('Error loading transfers:', error)
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

  const toggleGroupExpanded = (groupName) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }

  const toggleOrderExpanded = (orderId) => {
    const newExpanded = new Set(expandedOrders)
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId)
    } else {
      newExpanded.add(orderId)
    }
    setExpandedOrders(newExpanded)
  }

  const toggleAllGroups = () => {
    if (expandedGroups.size === 0) {
      // Expand all
      const allGroupNames = groupedOrders.data.map(g => 
        g.supplier_name || g.product_name || 'all'
      )
      setExpandedGroups(new Set(allGroupNames))
    } else {
      // Collapse all
      setExpandedGroups(new Set())
    }
  }

  // Group orders based on groupBy setting
  const getGroupedOrders = () => {
    if (groupBy === 'all') {
      return { 
        type: 'all', 
        data: [{
          name: 'All Purchase Orders',
          orders: filteredOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date)),
          totalAmount: filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
          orderCount: filteredOrders.length
        }]
      }
    }

    if (groupBy === 'supplier') {
      const grouped = {}
      filteredOrders.forEach(order => {
        const key = order.supplier?.vendor_name || 'Unknown Supplier'
        if (!grouped[key]) {
          grouped[key] = {
            supplier_name: key,
            orders: [],
            totalAmount: 0,
            orderCount: 0
          }
        }
        grouped[key].orders.push(order)
        grouped[key].totalAmount += order.total_amount || 0
        grouped[key].orderCount += 1
      })
      return { 
        type: 'supplier', 
        data: Object.values(grouped).sort((a, b) => a.supplier_name.localeCompare(b.supplier_name))
      }
    }

    if (groupBy === 'product') {
      const grouped = {}
      filteredOrders.forEach(order => {
        // Group by products in the order
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const key = item.product?.product_name || 'Unknown Product'
            if (!grouped[key]) {
              grouped[key] = {
                product_name: key,
                orders: [],
                totalQuantity: 0,
                totalAmount: 0,
                suppliers: new Set()
              }
            }
            // Add order only once per product
            if (!grouped[key].orders.some(o => o.id === order.id)) {
              grouped[key].orders.push(order)
            }
            grouped[key].totalQuantity += item.quantity || 0
            grouped[key].totalAmount += (item.quantity * item.unit_price) || 0
            if (order.supplier?.vendor_name) {
              grouped[key].suppliers.add(order.supplier.vendor_name)
            }
          })
        }
      })
      return { 
        type: 'product', 
        data: Object.values(grouped).sort((a, b) => b.totalQuantity - a.totalQuantity)
      }
    }

    return { type: 'none', data: filteredOrders }
  }

  const groupedOrders = getGroupedOrders()

  // Expand all groups by default when grouped data changes
  useEffect(() => {
    if (groupedOrders.type !== 'none' && groupedOrders.data.length > 0) {
      const allGroupNames = groupedOrders.data.map(g => 
        g.supplier_name || g.product_name
      )
      setExpandedGroups(new Set(allGroupNames))
    }
  }, [groupedOrders.data.length, groupBy])

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
    const order = orders.find(o => o.id === orderId)
    
    if (inspectionMode) {
      // In inspection mode, apply inspection-specific validation
      if (checked) {
        // Check if inspection is required
        if (order.inspection_required === false) {
          toast.error('Inspection is not required for this order')
          return
        }
        
        // Check if order already has an inspection
        const hasInspection = inspections.some(i => i.purchase_order_id === orderId)
        if (hasInspection) {
          toast.error('This order already has an inspection scheduled')
          return
        }
        
        // Check if order status allows inspection
        if (order.status === 'draft') {
          toast.error('Draft orders cannot be scheduled for inspection')
          return
        }
        if (order.status === 'cancelled') {
          toast.error('Cancelled orders cannot be scheduled for inspection')
          return
        }
        
        // If this is the first selection, just add it
        if (selectedOrders.length === 0) {
          setSelectedOrders([orderId])
        } else {
          // Check if all currently selected orders have the same supplier as this one
          const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
          const currentSupplierId = selectedOrdersData[0]?.supplier_id
          
          if (order.supplier_id === currentSupplierId) {
            setSelectedOrders([...selectedOrders, orderId])
          } else {
            toast.error('You can only select orders from the same supplier for inspection')
          }
        }
      } else {
        setSelectedOrders(selectedOrders.filter(id => id !== orderId))
      }
    } else if (transferMode) {
      // In transfer mode, only allow single selection
      if (checked) {
        // Check if order already has a transfer
        const hasTransfer = transfers.some(t => t.purchase_order_id === orderId)
        if (hasTransfer) {
          toast.error('This order has already been transferred')
          return
        }
        
        // Check if order status allows transfer
        if (order.status !== 'complete' && order.status !== 'approved' && order.status !== 'in_progress') {
          toast.error('Only approved, in progress, or completed orders can be received')
          return
        }
        
        // Only allow single selection in transfer mode
        setSelectedOrders([orderId])
      } else {
        setSelectedOrders([])
      }
    } else {
      // Normal mode - just toggle selection without restrictions
      if (checked) {
        setSelectedOrders([...selectedOrders, orderId])
      } else {
        setSelectedOrders(selectedOrders.filter(id => id !== orderId))
      }
    }
}

  const handleSelectAll = (checked) => {
    if (checked) {
      if (inspectionMode) {
        // Filter out draft, cancelled orders, orders with inspections, and orders not requiring inspection
        const selectableOrders = filteredOrders.filter(order => 
          order.status !== 'draft' && 
          order.status !== 'cancelled' &&
          order.inspection_required !== false &&
          !inspections.some(i => i.purchase_order_id === order.id)
        )
        
        if (selectableOrders.length === 0) {
          toast.error('No orders available for inspection')
          return
        }
        
        // Check if all selectable orders have the same supplier
        const supplierIds = [...new Set(selectableOrders.map(order => order.supplier_id))]
        
        if (supplierIds.length === 1) {
          setSelectedOrders(selectableOrders.map(order => order.id))
        } else {
          toast.error('Cannot select all - orders have different suppliers. Select orders from one supplier at a time.')
        }
      } else if (transferMode) {
        // In transfer mode, cannot select all
        toast.error('Please select one order at a time for receiving')
      } else {
        // Normal mode - select all visible orders
        setSelectedOrders(filteredOrders.map(order => order.id))
      }
    } else {
      setSelectedOrders([])
    }
  }

  const handleCreateTransfer = () => {
    if (selectedOrders.length === 0) {
      toast.error('Please select a purchase order')
      return
    }
    
    const selectedOrder = orders.find(order => order.id === selectedOrders[0])
    
    // Check if order is complete or approved
    if (selectedOrder.status !== 'complete' && selectedOrder.status !== 'approved' && selectedOrder.status !== 'in_progress') {
      toast.error('Only approved, in progress, or completed orders can be received')
      return
    }
    
    // Navigate to transfers page with PO data and instant flag
    router.push(`/seller/transfers?create=true&type=in&po=${encodeURIComponent(selectedOrder.po_number)}&instant=true`)
    
    // Clear selection and exit transfer mode
    setSelectedOrders([])
    setTransferMode(false)
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
          latestGoodsReadyDate: null,
          skuSummary: {}
        }
      }
      groups[supplierId].orders.push(order)
      
      // Update latest goods ready date
      const orderDate = order.goods_ready_date || order.requested_delivery_date
      if (orderDate && (!groups[supplierId].latestGoodsReadyDate || 
          new Date(orderDate) > new Date(groups[supplierId].latestGoodsReadyDate))) {
        groups[supplierId].latestGoodsReadyDate = orderDate
      }
      
      // Aggregate SKU quantities
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const sku = item.product?.sku || 'Unknown'
          if (!groups[supplierId].skuSummary[sku]) {
            groups[supplierId].skuSummary[sku] = {
              name: item.product?.product_name || 'Unknown Product',
              quantity: 0,
              unit: item.product?.unit_of_measure || 'units'
            }
          }
          groups[supplierId].skuSummary[sku].quantity += item.quantity
        })
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
            {inspectionMode ? (
              <>
                <Button
                  onClick={() => {
                    setInspectionMode(false)
                    setSelectedOrders([])
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleScheduleInspection}
                  variant="default"
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={selectedOrders.length === 0}
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Schedule Inspection {selectedOrders.length > 0 && `(${selectedOrders.length})`}
                </Button>
              </>
            ) : transferMode ? (
              <>
                <Button
                  onClick={() => {
                    setTransferMode(false)
                    setSelectedOrders([])
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTransfer}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={selectedOrders.length === 0}
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Receive into System
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setTransferMode(true)
                    setSelectedOrders([])
                  }}
                  variant="outline"
                >
                  <ArrowDownToLine className="h-4 w-4 mr-2" />
                  Receive Inventory
                </Button>
                <Button
                  onClick={() => {
                    setInspectionMode(true)
                    setSelectedOrders([])
                  }}
                  variant="outline"
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  Create Inspection
                </Button>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Purchase Order
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Inspection Mode Banner */}
      {inspectionMode && (
        <Alert className="mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <ClipboardCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Inspection Mode:</strong> Select orders from the same supplier to create an inspection. 
            Orders with existing inspections cannot be selected.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Transfer Mode Banner */}
      {transferMode && (
        <Alert className="mb-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <ArrowDownToLine className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-900 dark:text-green-100">
            <strong>Receive Inventory Mode:</strong> Select a single approved or completed order to receive into the system. 
            This will record inventory at the supplier warehouse, ready for future transfers.
          </AlertDescription>
        </Alert>
      )}

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

      {/* Grouping Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <ToggleGroup type="single" value={groupBy} onValueChange={setGroupBy}>
            <ToggleGroupItem value="supplier" aria-label="Group by supplier">
              Group by Supplier
            </ToggleGroupItem>
            <ToggleGroupItem value="all" aria-label="View all POs">
              View All POs
            </ToggleGroupItem>
            <ToggleGroupItem value="product" aria-label="Group by product">
              Group by Product
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {groupBy !== 'all' && groupedOrders.data.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllGroups}
          >
            {expandedGroups.size === 0 ? 'Expand All' : 'Collapse All'}
          </Button>
        )}
      </div>

      {/* Orders Table */}
      <Card>
        <Table>
          {/* Only show headers for non-grouped views */}
          {groupBy === 'all' && (
            <TableHeader>
              <TableRow>
                {(inspectionMode || transferMode) && (
                  <TableHead className="w-12">
                    {!transferMode ? (
                      <Checkbox
                        checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    ) : (
                      <span className="text-xs">Select</span>
                    )}
                  </TableHead>
                )}
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-20">View</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Goods Ready</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inspection</TableHead>
                <TableHead>Transfer Status</TableHead>
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={(groupBy === 'product' || groupBy === 'supplier') ? 1 : (inspectionMode || transferMode ? 12 : 11)} className="text-center py-8">
                  Loading purchase orders...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(groupBy === 'product' || groupBy === 'supplier') ? 1 : (inspectionMode || transferMode ? 12 : 11)} className="text-center py-8">
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
            ) : groupedOrders.type === 'all' || groupedOrders.type === 'none' ? (
              // Regular flat list rendering
              filteredOrders.map((order) => {
                const StatusIcon = statusConfig[order.status]?.icon || FileText
                const isSelected = selectedOrders.includes(order.id)
                
                // Check if order already has an active inspection
                const orderInspection = inspections.find(i => i.purchase_order_id === order.id)
                
                // Check if order has been transferred
                const orderTransfer = transfers.find(t => t.purchase_order_id === order.id)
                
                // Determine if this order can be selected
                let canSelect = true
                let disabledReason = ''
                
                if (inspectionMode) {
                  // In inspection mode, apply restrictions
                  if (order.inspection_required === false) {
                    canSelect = false
                    disabledReason = 'Inspection not required'
                  } else if (orderInspection) {
                    canSelect = false
                    disabledReason = 'Already has inspection'
                  } else if (order.status === 'draft' || order.status === 'cancelled') {
                    canSelect = false
                    disabledReason = order.status === 'draft' ? 'Draft orders cannot be inspected' : 'Cancelled orders cannot be inspected'
                  } else if (selectedOrders.length > 0 && !isSelected) {
                    const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
                    const currentSupplierId = selectedOrdersData[0]?.supplier_id
                    
                    if (order.supplier_id !== currentSupplierId) {
                      canSelect = false
                      disabledReason = 'Different supplier'
                    }
                  }
                } else if (transferMode) {
                  // In transfer mode, apply restrictions
                  if (orderTransfer) {
                    canSelect = false
                    disabledReason = 'Already transferred'
                  } else if (order.status !== 'complete' && order.status !== 'approved' && order.status !== 'in_progress') {
                    canSelect = false
                    disabledReason = 'Only approved, in progress, or completed orders can be transferred'
                  }
                }
                // In normal mode, all checkboxes are enabled
                
                return (
                  <React.Fragment key={order.id}>
                    <TableRow
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${
                        (inspectionMode || transferMode) && !canSelect && !isSelected ? 'opacity-50' : ''
                      }`}
                    >
                    {(inspectionMode || transferMode) && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectOrder(order.id, checked)}
                          aria-label={`Select ${order.po_number}`}
                          disabled={!canSelect && !isSelected && !transferMode}
                        />
                      </TableCell>
                    )}
                    <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                      {order.items && order.items.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-6 w-6"
                          onClick={() => toggleOrderExpanded(order.id)}
                        >
                          {expandedOrders.has(order.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/seller/purchase-orders/${order.id}`)}
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
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
                    <TableCell className="cursor-pointer" onClick={() => handleRowClick(order.id)}>
                      {order.inspection_required === false ? (
                        <Badge variant="secondary" className="text-xs font-medium">
                          <XCircle className="h-3 w-3 mr-1" />
                          Not Required
                        </Badge>
                      ) : orderInspection ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                            <Eye className="h-3 w-3 mr-1" />
                            {orderInspection.inspection_number || 'No Number'}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="cursor-pointer" onClick={() => handleRowClick(order.id)}>
                      {orderTransfer ? (
                        <Badge variant="green" className="text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Transferred
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* Render expanded order details immediately after each order */}
                  {expandedOrders.has(order.id) && order.items && order.items.length > 0 && (
                    <TableRow className="bg-slate-50 dark:bg-slate-900">
                      <TableCell colSpan={inspectionMode || transferMode ? 13 : 12}>
                      <div className="px-8 py-2">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                          Order Items:
                        </div>
                        <Table className="w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">SKU</TableHead>
                              <TableHead className="text-xs">Product Name</TableHead>
                              <TableHead className="text-xs text-right">Quantity</TableHead>
                              <TableHead className="text-xs text-right">Unit Price</TableHead>
                              <TableHead className="text-xs text-right">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.items.map((item, idx) => (
                              <TableRow key={idx} className="border-b-0">
                                <TableCell className="py-2 text-xs">{item.product?.sku || '-'}</TableCell>
                                <TableCell className="py-2 text-xs">{item.product?.product_name || '-'}</TableCell>
                                <TableCell className="py-2 text-xs text-right">
                                  {item.quantity} {item.product?.unit_of_measure || 'units'}
                                </TableCell>
                                <TableCell className="py-2 text-xs text-right">
                                  ${(item.unit_price || 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="py-2 text-xs text-right">
                                  ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              )})
            ) : (
              // Grouped rendering
              groupedOrders.data.map((group) => {
                const groupName = group.supplier_name || group.product_name
                const isExpanded = expandedGroups.has(groupName)
                
                return (
                  <React.Fragment key={groupName}>
                    {/* Group Header Row */}
                    <TableRow 
                      className="bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => toggleGroupExpanded(groupName)}
                    >
                      <TableCell colSpan={inspectionMode || transferMode ? 13 : 12}>
                        <div className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-semibold">{groupName}</span>
                            <Badge variant="secondary" className="ml-2">
                              {group.orderCount} order{group.orderCount !== 1 ? 's' : ''}
                            </Badge>
                            {groupBy === 'product' && group.suppliers.size > 0 && (
                              <span className="text-sm text-muted-foreground">
                                ({Array.from(group.suppliers).join(', ')})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {groupBy === 'product' && (
                              <span className="text-sm font-medium">
                                Total: {group.totalQuantity} units
                              </span>
                            )}
                            <span className="text-sm font-medium">
                              {formatCurrency(group.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Table headers for grouped views */}
                    {isExpanded && (groupBy === 'product' || groupBy === 'supplier') && (
                      <TableRow>
                        {(inspectionMode || transferMode) && (
                          <TableHead className="w-12">
                            <span className="text-xs">Select</span>
                          </TableHead>
                        )}
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-20">View</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Goods Ready</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Inspection</TableHead>
                        <TableHead>Transfer Status</TableHead>
                      </TableRow>
                    )}
                    
                    {/* Group Items */}
                    {isExpanded && group.orders.map((order) => {
                      const StatusIcon = statusConfig[order.status]?.icon || FileText
                      const isSelected = selectedOrders.includes(order.id)
                      
                      // Check if order already has an active inspection
                      const orderInspection = inspections.find(i => i.purchase_order_id === order.id)
                      
                      // Check if order has been transferred
                      const orderTransfer = transfers.find(t => t.purchase_order_id === order.id)
                      
                      // Determine if this order can be selected
                      let canSelect = true
                      let disabledReason = ''
                      
                      if (inspectionMode) {
                        // In inspection mode, apply restrictions
                        if (order.inspection_required === false) {
                          canSelect = false
                          disabledReason = 'Inspection not required'
                        } else if (orderInspection) {
                          canSelect = false
                          disabledReason = 'Already has inspection'
                        } else if (order.status === 'draft' || order.status === 'cancelled') {
                          canSelect = false
                          disabledReason = order.status === 'draft' ? 'Draft orders cannot be inspected' : 'Cancelled orders cannot be inspected'
                        } else if (selectedOrders.length > 0 && !isSelected) {
                          const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id))
                          const currentSupplierId = selectedOrdersData[0]?.supplier_id
                          
                          if (order.supplier_id !== currentSupplierId) {
                            canSelect = false
                            disabledReason = 'Different supplier'
                          }
                        }
                      } else if (transferMode) {
                        // In transfer mode, apply restrictions
                        if (orderTransfer) {
                          canSelect = false
                          disabledReason = 'Already transferred'
                        } else if (order.status !== 'complete' && order.status !== 'approved' && order.status !== 'in_progress') {
                          canSelect = false
                          disabledReason = 'Only approved, in progress, or completed orders can be transferred'
                        }
                      }
                      // In normal mode, all checkboxes are enabled
                      
                      return (
                        <React.Fragment key={order.id}>
                          <TableRow
                            className={`hover:bg-gray-50 dark:hover:bg-slate-800 ${
                              (inspectionMode || transferMode) && !canSelect && !isSelected ? 'opacity-50' : ''
                            }`}
                          >
                          {(inspectionMode || transferMode) && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => handleSelectOrder(order.id, checked)}
                                aria-label={`Select ${order.po_number}`}
                                disabled={!canSelect && !isSelected && !transferMode}
                              />
                            </TableCell>
                          )}
                          <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
                            {order.items && order.items.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-0 h-6 w-6"
                                onClick={() => toggleOrderExpanded(order.id)}
                              >
                                {expandedOrders.has(order.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/seller/purchase-orders/${order.id}`)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
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
                          <TableCell className="cursor-pointer" onClick={() => handleRowClick(order.id)}>
                            {order.inspection_required === false ? (
                              <Badge variant="secondary" className="text-xs font-medium">
                                <XCircle className="h-3 w-3 mr-1" />
                                Not Required
                              </Badge>
                            ) : orderInspection ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800">
                                  <Eye className="h-3 w-3 mr-1" />
                                  {orderInspection.inspection_number || 'No Number'}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="cursor-pointer" onClick={() => handleRowClick(order.id)}>
                            {orderTransfer ? (
                              <Badge variant="green" className="text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Transferred
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Render expanded order details immediately after each order */}
                        {expandedOrders.has(order.id) && order.items && order.items.length > 0 && (
                          <TableRow className="bg-slate-50 dark:bg-slate-900">
                            <TableCell colSpan={inspectionMode || transferMode ? 13 : 12}>
                              <div className="px-8 py-2">
                                <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                                  Order Items:
                                </div>
                                <Table className="w-full">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs">SKU</TableHead>
                                      <TableHead className="text-xs">Product Name</TableHead>
                                      <TableHead className="text-xs text-right">Quantity</TableHead>
                                      <TableHead className="text-xs text-right">Unit Price</TableHead>
                                      <TableHead className="text-xs text-right">Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {order.items.map((item, idx) => (
                                      <TableRow key={idx} className="border-b-0">
                                        <TableCell className="py-2 text-xs">{item.product?.sku || '-'}</TableCell>
                                        <TableCell className="py-2 text-xs">{item.product?.product_name || '-'}</TableCell>
                                        <TableCell className="py-2 text-xs text-right">
                                          {item.quantity} {item.product?.unit_of_measure || 'units'}
                                        </TableCell>
                                        <TableCell className="py-2 text-xs text-right">
                                          ${(item.unit_price || 0).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="py-2 text-xs text-right">
                                          ${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
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
        onSuccess={(inspectionIds) => {
          setSelectedOrders([])
          setInspectionMode(false)
          toast.success('Inspection(s) scheduled successfully')
          
          // Redirect to inspections page with highlight parameter
          if (inspectionIds && inspectionIds.length > 0) {
            router.push(`/seller/inspections?highlight=${inspectionIds.join(',')}`)
          }
        }}
      />
    </div>
  )
}