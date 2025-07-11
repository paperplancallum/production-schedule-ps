'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Search, Package, Truck, CheckCircle, XCircle, Clock, ArrowRight, Building, Warehouse } from 'lucide-react'
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

  useEffect(() => {
    // Check for transfer creation from PO
    const createTransfer = searchParams.get('create')
    const transferType = searchParams.get('type')
    const poNumbers = searchParams.get('po')

    if (createTransfer === 'true' && transferType && poNumbers) {
      // Set transfer type
      setFormData(prev => ({
        ...prev,
        transfer_type: transferType,
        purchase_order_id: poNumbers,
        from_location: 'Supplier Warehouse',
        from_location_type: 'supplier_warehouse',
        to_location: '',
        to_location_type: '3pl_warehouse',
        notes: `Receiving inventory from Purchase Orders: ${poNumbers}`
      }))
      
      // Open dialog
      setCreateDialogOpen(true)
      
      // Load PO data to get items
      loadPurchaseOrderData(poNumbers)
      
      // Clear URL parameters
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('create')
      newUrl.searchParams.delete('type')
      newUrl.searchParams.delete('po')
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams])

  const loadTransfers = async () => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      // For now, we'll simulate transfers data
      // In a real implementation, this would fetch from a transfers table
      const mockTransfers = [
        {
          id: '1',
          transfer_number: 'TRF-2025-0001',
          transfer_type: 'in',
          purchase_order_number: 'PO-2025-0123',
          from_location: 'Guangzhou Factory',
          from_location_type: 'production',
          to_location: 'Shenzhen Warehouse',
          to_location_type: 'supplier_warehouse',
          status: 'in_transit',
          created_at: new Date().toISOString(),
          estimated_arrival: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          tracking_number: 'SF1234567890',
          carrier: 'SF Express',
          items: [
            { sku: 'PROD-001', product_name: 'Widget A', quantity: 500 },
            { sku: 'PROD-002', product_name: 'Widget B', quantity: 300 }
          ]
        },
        {
          id: '2',
          transfer_number: 'TRF-2025-0002',
          transfer_type: 'transfer',
          from_location: 'Shenzhen Warehouse',
          from_location_type: 'supplier_warehouse',
          to_location: 'LA 3PL Warehouse',
          to_location_type: '3pl_warehouse',
          status: 'arrived',
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          estimated_arrival: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          actual_arrival: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          tracking_number: 'DHL9876543210',
          carrier: 'DHL',
          items: [
            { sku: 'PROD-003', product_name: 'Gadget X', quantity: 1000 }
          ]
        },
        {
          id: '3',
          transfer_number: 'TRF-2025-0003',
          transfer_type: 'out',
          from_location: 'LA 3PL Warehouse',
          from_location_type: '3pl_warehouse',
          to_location: 'Amazon FBA LAX9',
          to_location_type: 'amazon_fba',
          status: 'pending',
          created_at: new Date().toISOString(),
          estimated_arrival: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          tracking_number: '',
          carrier: 'Amazon Partner Carrier',
          items: [
            { sku: 'PROD-001', product_name: 'Widget A', quantity: 200 },
            { sku: 'PROD-003', product_name: 'Gadget X', quantity: 500 }
          ]
        }
      ]

      const filteredTransfers = statusFilter === 'all' 
        ? mockTransfers 
        : mockTransfers.filter(t => t.status === statusFilter)

      setTransfers(filteredTransfers)
      calculateStats(mockTransfers)
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

  const loadPurchaseOrderData = async (poNumbers) => {
    try {
      const poNumberArray = poNumbers.split(',')
      
      // Fetch PO data
      const response = await fetch('/api/purchase-orders')
      const allOrders = await response.json()
      
      if (response.ok) {
        // Filter for the specific POs
        const selectedOrders = allOrders.filter(order => 
          poNumberArray.includes(order.po_number)
        )
        
        // Aggregate items from all selected POs
        const aggregatedItems = []
        
        selectedOrders.forEach(order => {
          if (order.items && order.items.length > 0) {
            order.items.forEach(item => {
              const existingItem = aggregatedItems.find(i => 
                i.sku === item.product?.sku
              )
              
              if (existingItem) {
                existingItem.quantity += item.quantity
              } else {
                aggregatedItems.push({
                  sku: item.product?.sku || 'Unknown',
                  product_name: item.product?.product_name || 'Unknown Product',
                  quantity: item.quantity,
                  unit: item.product?.unit_of_measure || 'units'
                })
              }
            })
          }
        })
        
        // Update form with items and supplier info
        const firstOrder = selectedOrders[0]
        if (firstOrder) {
          setFormData(prev => ({
            ...prev,
            from_location: firstOrder.supplier?.vendor_name || 'Supplier Warehouse',
            items: aggregatedItems
          }))
        }
      }
    } catch (error) {
      console.error('Error loading PO data:', error)
      toast.error('Failed to load purchase order data')
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
      
      // In a real implementation, this would save to the database with formData
      // For now, show success with details
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
              <TableHead>Items</TableHead>
              <TableHead>Est. Arrival</TableHead>
              <TableHead>Tracking</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading transfers...
                </TableCell>
              </TableRow>
            ) : filteredTransfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
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
                      <div className="text-sm">
                        {transfer.items?.length || 0} items
                        {transfer.items && transfer.items.length > 0 && (
                          <div className="text-xs text-slate-500">
                            {transfer.items.reduce((sum, item) => sum + item.quantity, 0)} units
                          </div>
                        )}
                      </div>
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
                  <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
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
                        <span>Total Items:</span>
                        <span>{formData.items.reduce((sum, item) => sum + item.quantity, 0)} units</span>
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