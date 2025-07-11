'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Package, Truck, CheckCircle, XCircle, Clock, ArrowRight, Building, Warehouse, Trash2, MoreHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const statusConfig = {
  pending: { label: 'Pending', color: 'secondary', icon: Clock },
  in_transit: { label: 'In Transit', color: 'blue', icon: Truck },
  arrived: { label: 'Arrived', color: 'green', icon: CheckCircle },
  delayed: { label: 'Delayed', color: 'yellow', icon: Clock },
  cancelled: { label: 'Cancelled', color: 'destructive', icon: XCircle }
}

const transferTypes = [
  { value: 'in', label: 'In', description: 'Receiving from Purchase Order', color: 'green' },
  { value: 'transfer', label: 'Transfer', description: 'Moving between locations', color: 'blue' },
  { value: 'out', label: 'Out', description: 'Shipping to customer/FBA', color: 'orange' }
]

const locationTypes = [
  { value: 'production', label: 'Production', icon: Building },
  { value: 'supplier_warehouse', label: 'Supplier Warehouse', icon: Warehouse },
  { value: '3pl_warehouse', label: '3PL Warehouse', icon: Warehouse },
  { value: 'amazon_fba', label: 'Amazon FBA', icon: Package },
  { value: 'other', label: 'Other', icon: Building }
]

export default function TransfersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedTransfers, setSelectedTransfers] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_transit: 0,
    arrived: 0
  })
  const [formData, setFormData] = useState({
    transfer_number: '',
    transfer_type: 'transfer',
    purchase_order_id: '',
    from_location: '',
    from_location_type: '',
    to_location: '',
    to_location_type: '',
    estimated_arrival: '',
    tracking_number: '',
    carrier: '',
    notes: '',
    items: []
  })
  const supabase = createClient()

  useEffect(() => {
    loadTransfers()
  }, [statusFilter])

  const hasProcessedRef = useRef(false)

  useEffect(() => {
    // Check for transfer creation from PO
    const createTransfer = searchParams.get('create')
    const transferType = searchParams.get('type')
    const poNumber = searchParams.get('po')
    const isInstant = searchParams.get('instant') === 'true'

    if (createTransfer === 'true' && transferType && poNumber && !hasProcessedRef.current) {
      // Mark as processed immediately
      hasProcessedRef.current = true
      
      // Clear URL parameters immediately to prevent double execution
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('create')
      newUrl.searchParams.delete('type')
      newUrl.searchParams.delete('po')
      newUrl.searchParams.delete('instant')
      window.history.replaceState({}, '', newUrl)
      
      if (isInstant) {
        // For instant transfers, create it immediately
        createInstantTransfer(poNumber).finally(() => {
          // Reset the ref after a delay to allow for new transfers
          setTimeout(() => {
            hasProcessedRef.current = false
          }, 1000)
        })
      } else {
        // Set transfer type
        setFormData(prev => ({
          ...prev,
          transfer_type: transferType,
          purchase_order_id: poNumber,
          from_location: 'Supplier Warehouse',
          from_location_type: 'supplier_warehouse',
          to_location: '',
          to_location_type: '3pl_warehouse',
          notes: `Receiving inventory from Purchase Order: ${poNumber}`
        }))
        
        // Open dialog
        setCreateDialogOpen(true)
        
        // Load PO data to get items
        loadPurchaseOrderData(poNumber)
        
        // Reset the ref after a delay
        setTimeout(() => {
          hasProcessedRef.current = false
        }, 1000)
      }
    }
  }, [searchParams])

  const loadTransfers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      const response = await fetch(`/api/transfers?${params}`)
      const data = await response.json()

      if (response.ok) {
        setTransfers(data)
        calculateStats(data)
      } else {
        console.error('Error loading transfers:', data.error)
        toast.error('Failed to load transfers')
      }
    } catch (error) {
      console.error('Error loading transfers:', error)
      toast.error('Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (transferData) => {
    const stats = {
      total: transferData.length,
      pending: transferData.filter(t => t.status === 'pending').length,
      in_transit: transferData.filter(t => t.status === 'in_transit').length,
      arrived: transferData.filter(t => t.status === 'arrived').length
    }
    setStats(stats)
  }

  const loadPurchaseOrderData = async (poNumber) => {
    try {
      // Fetch PO data
      const response = await fetch('/api/purchase-orders')
      const allOrders = await response.json()
      
      if (response.ok) {
        // Find the specific PO
        const selectedOrder = allOrders.find(order => order.po_number === poNumber)
        
        if (selectedOrder) {
          // Collect items from the PO
          const items = []
          
          if (selectedOrder.items && selectedOrder.items.length > 0) {
            selectedOrder.items.forEach(item => {
              items.push({
                sku: item.product?.sku || 'Unknown',
                product_name: item.product?.product_name || 'Unknown Product',
                quantity: item.quantity,
                unit: item.product?.unit_of_measure || 'units'
              })
            })
          }
          
          // Update form with items and supplier info
          setFormData(prev => ({
            ...prev,
            from_location: selectedOrder.supplier?.vendor_name || 'Supplier Warehouse',
            items: items
          }))
          
          return selectedOrder
        }
      }
    } catch (error) {
      console.error('Error loading PO data:', error)
      toast.error('Failed to load purchase order data')
    }
    return null
  }

  const createInstantTransfer = async (poNumber) => {
    try {
      // First check if a transfer already exists for this PO
      const existingTransfers = await fetch('/api/transfers')
      const existingData = await existingTransfers.json()
      
      if (existingData && existingData.some(t => t.purchase_order_number === poNumber)) {
        toast.error(`A transfer already exists for Purchase Order ${poNumber}`)
        return
      }
      
      // Load PO data
      const poData = await loadPurchaseOrderData(poNumber)
      
      if (!poData) {
        toast.error('Failed to load purchase order data')
        return
      }
      
      // Create a separate transfer for each SKU (ledger style)
      const transfers = []
      let successCount = 0
      let totalQuantity = 0
      
      for (const item of (poData.items || [])) {
        const transferNumber = `TRF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        
        const transferData = {
          transfer_number: transferNumber,
          transfer_type: 'in',
          purchase_order_id: poData.id,
          purchase_order_number: poNumber,
          from_location: poData.supplier?.vendor_name || 'Supplier',
          from_location_type: 'supplier',
          to_location: `${poData.supplier?.vendor_name || 'Supplier'} Warehouse`,
          to_location_type: 'supplier_warehouse',
          status: 'arrived',
          actual_arrival: new Date().toISOString(),
          notes: `Received ${item.product?.sku || 'Unknown SKU'} from PO: ${poNumber}`,
          items: [{
            sku: item.product?.sku || 'Unknown',
            product_name: item.product?.product_name || 'Unknown Product',
            quantity: item.quantity,
            unit: item.product?.unit_of_measure || 'units'
          }]
        }
        
        try {
          // Save each transfer to database
          const response = await fetch('/api/transfers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(transferData)
          })

          if (!response.ok) {
            const error = await response.json()
            console.error(`Failed to create transfer for ${item.product?.sku}:`, error)
          } else {
            successCount++
            totalQuantity += item.quantity
            transfers.push(await response.json())
          }
        } catch (error) {
          console.error(`Error creating transfer for ${item.product?.sku}:`, error)
        }
      }
      
      if (successCount > 0) {
        toast.success(
          `Inventory received successfully! Created ${successCount} transfer${successCount > 1 ? 's' : ''} (${totalQuantity} total units) at ${poData.supplier?.vendor_name || 'Supplier'} Warehouse.`
        )
        
        // Reload transfers to update the UI
        loadTransfers()
      } else {
        toast.error('Failed to create any transfers')
      }
    } catch (error) {
      console.error('Error creating instant transfers:', error)
      toast.error('Failed to receive inventory')
    }
  }

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = !searchTerm || 
      transfer.transfer_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.from_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.to_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString()
  }

  const handleRowClick = (transferId) => {
    // In the future, this could navigate to a transfer details page
    toast.info(`Transfer ${transferId} details coming soon`)
  }

  const handleSelectTransfer = (transferId, checked) => {
    if (checked) {
      setSelectedTransfers([...selectedTransfers, transferId])
    } else {
      setSelectedTransfers(selectedTransfers.filter(id => id !== transferId))
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedTransfers(filteredTransfers.map(transfer => transfer.id))
    } else {
      setSelectedTransfers([])
    }
  }

  const handleCreateTransfer = async (e) => {
    e.preventDefault()
    try {
      // Generate transfer number
      const transferNumber = `TRF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
      
      // Create the new transfer
      const newTransfer = {
        transfer_number: transferNumber,
        transfer_type: formData.transfer_type,
        purchase_order_number: formData.purchase_order_id,
        from_location: formData.from_location,
        from_location_type: formData.from_location_type,
        to_location: formData.to_location,
        to_location_type: formData.to_location_type,
        status: 'pending',
        estimated_arrival: formData.estimated_arrival ? new Date(formData.estimated_arrival).toISOString() : null,
        tracking_number: formData.tracking_number || null,
        carrier: formData.carrier || null,
        notes: formData.notes || null,
        items: formData.items || []
      }
      
      // Save to database
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTransfer)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create transfer')
      }

      const createdTransfer = await response.json()
      
      const itemCount = formData.items?.length || 0
      const totalQuantity = formData.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
      
      toast.success(
        `Transfer ${transferNumber} created successfully${
          itemCount > 0 ? ` with ${itemCount} items (${totalQuantity} units)` : ''
        }`
      )
      
      // Reset form and close dialog
      setFormData({
        transfer_number: '',
        transfer_type: 'transfer',
        purchase_order_id: '',
        from_location: '',
        from_location_type: '',
        to_location: '',
        to_location_type: '',
        estimated_arrival: '',
        tracking_number: '',
        carrier: '',
        notes: '',
        items: []
      })
      setCreateDialogOpen(false)
      loadTransfers()
    } catch (error) {
      console.error('Error creating transfer:', error)
      toast.error('Failed to create transfer')
    }
  }

  const getLocationIcon = (locationType) => {
    const location = locationTypes.find(lt => lt.value === locationType)
    return location?.icon || Building
  }

  const handleDeleteTransfer = async (transferId) => {
    if (!confirm('Are you sure you want to delete this transfer?')) {
      return
    }

    try {
      const response = await fetch(`/api/transfers?id=${transferId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete transfer')
      }

      toast.success('Transfer deleted successfully')
      loadTransfers()
    } catch (error) {
      console.error('Error deleting transfer:', error)
      toast.error('Failed to delete transfer')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Transfers
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Manage inventory movements between locations
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Transfer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Transfers</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
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
            <CardDescription>In Transit</CardDescription>
            <CardTitle className="text-2xl">{stats.in_transit}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Arrived</CardDescription>
            <CardTitle className="text-2xl">{stats.arrived}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by transfer number, location, or tracking..."
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

      {/* Transfers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedTransfers.length === filteredTransfers.length && filteredTransfers.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Transfer Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Est. Arrival</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Loading transfers...
                </TableCell>
              </TableRow>
            ) : filteredTransfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-gray-500">No transfers found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      Create your first transfer
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransfers.map((transfer) => {
                const StatusIcon = statusConfig[transfer.status]?.icon || Clock
                const FromIcon = getLocationIcon(transfer.from_location_type)
                const ToIcon = getLocationIcon(transfer.to_location_type)
                const isSelected = selectedTransfers.includes(transfer.id)
                
                return (
                  <TableRow
                    key={transfer.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectTransfer(transfer.id, checked)}
                        aria-label={`Select ${transfer.transfer_number}`}
                      />
                    </TableCell>
                    <TableCell 
                      className="font-medium"
                      onClick={() => handleRowClick(transfer.id)}
                    >
                      {transfer.transfer_number}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          transfer.transfer_type === 'in' ? 'green' :
                          transfer.transfer_type === 'out' ? 'orange' :
                          'blue'
                        } className="text-xs">
                          {transferTypes.find(t => t.value === transfer.transfer_type)?.label || transfer.transfer_type}
                        </Badge>
                        {transfer.transfer_type === 'in' && transfer.purchase_order_number && (
                          <span className="text-xs text-slate-500">
                            {transfer.purchase_order_number}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      <div className="flex items-center gap-2">
                        <FromIcon className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium">{transfer.from_location}</div>
                          <div className="text-xs text-slate-500">
                            {locationTypes.find(lt => lt.value === transfer.from_location_type)?.label}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      <div className="flex items-center gap-2">
                        <ToIcon className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-medium">{transfer.to_location}</div>
                          <div className="text-xs text-slate-500">
                            {locationTypes.find(lt => lt.value === transfer.to_location_type)?.label}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      {transfer.items && transfer.items.length > 0 ? (
                        <span className="font-medium">{transfer.items[0].sku}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      {transfer.items && transfer.items.length > 0 ? (
                        <div className="text-sm">
                          <span className="font-medium">{transfer.items[0].quantity}</span>
                          <span className="text-slate-500 ml-1">{transfer.items[0].unit || 'units'}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      {formatDate(transfer.estimated_arrival)}
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      <div className="text-sm">
                        {transfer.tracking_number || '-'}
                        {transfer.carrier && (
                          <div className="text-xs text-slate-500">{transfer.carrier}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={() => handleRowClick(transfer.id)}>
                      <Badge variant={statusConfig[transfer.status]?.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[transfer.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleDeleteTransfer(transfer.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Transfer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Transfer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Transfer</DialogTitle>
            <DialogDescription>
              Record inventory movement between locations
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTransfer}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 space-y-2">
                <Label>Transfer Type *</Label>
                <Select
                  value={formData.transfer_type}
                  onValueChange={(value) => setFormData({ ...formData, transfer_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select transfer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{type.label}</span>
                          <span className="text-xs text-muted-foreground">- {type.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {formData.transfer_type === 'in' && (
                <div className="col-span-2 space-y-2">
                  <Label>Purchase Order Reference</Label>
                  <Input
                    value={formData.purchase_order_id}
                    onChange={(e) => setFormData({ ...formData, purchase_order_id: e.target.value })}
                    placeholder="Enter PO number (optional)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Link this transfer to a Purchase Order for tracking
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>From Location *</Label>
                <Input
                  value={formData.from_location}
                  onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                  placeholder="e.g. Guangzhou Factory"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>From Location Type *</Label>
                <Select
                  value={formData.from_location_type}
                  onValueChange={(value) => setFormData({ ...formData, from_location_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Location *</Label>
                <Input
                  value={formData.to_location}
                  onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                  placeholder="e.g. LA Warehouse"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>To Location Type *</Label>
                <Select
                  value={formData.to_location_type}
                  onValueChange={(value) => setFormData({ ...formData, to_location_type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated Arrival Date</Label>
                <Input
                  type="date"
                  value={formData.estimated_arrival}
                  onChange={(e) => setFormData({ ...formData, estimated_arrival: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Carrier</Label>
                <Input
                  value={formData.carrier}
                  onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                  placeholder="e.g. DHL, FedEx"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Tracking Number</Label>
                <Input
                  value={formData.tracking_number}
                  onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                  placeholder="Enter tracking number"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
              
              {/* Show items if creating from PO */}
              {formData.items && formData.items.length > 0 && (
                <div className="col-span-2 space-y-2">
                  <Label>Items to Transfer</Label>
                  <div className="border rounded-md p-4">
                    <div className="text-sm text-muted-foreground mb-2">
                      Note: Each SKU will create a separate transfer entry
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {formData.items.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-900 rounded">
                          <div>
                            <span className="font-medium">{item.sku}</span>
                            <span className="text-muted-foreground ml-2">- {item.product_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{item.quantity}</span>
                            <span className="text-muted-foreground ml-1">{item.unit}</span>
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between items-center font-medium">
                          <span>Total Transfers to Create:</span>
                          <span>{formData.items.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setCreateDialogOpen(false)
                // Reset form to defaults
                setFormData({
                  transfer_number: '',
                  transfer_type: 'transfer',
                  purchase_order_id: '',
                  from_location: '',
                  from_location_type: '',
                  to_location: '',
                  to_location_type: '',
                  estimated_arrival: '',
                  tracking_number: '',
                  carrier: '',
                  notes: '',
                  items: []
                })
              }}>
                Cancel
              </Button>
              <Button type="submit">
                Create Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}