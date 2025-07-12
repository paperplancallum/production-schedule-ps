'use client'

import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { createClient } from '@/lib/supabase/client'
import { Building, Warehouse, Package, Truck, Search, RefreshCw, ArrowRight, TrendingUp, TrendingDown, ArrowDownToLine, ChevronRight, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'

const locationStages = [
  { 
    id: 'production',
    label: 'Production',
    icon: Building,
    color: 'blue',
    description: 'Items currently in production'
  },
  { 
    id: 'supplier_warehouse',
    label: 'Supplier Warehouse',
    icon: Warehouse,
    color: 'purple',
    description: 'Items in supplier storage'
  },
  { 
    id: '3pl_warehouse',
    label: '3PL Warehouse',
    icon: Warehouse,
    color: 'orange',
    description: 'Items at third-party logistics'
  },
  { 
    id: 'amazon_fba',
    label: 'Amazon FBA',
    icon: Package,
    color: 'green',
    description: 'Items at Amazon fulfillment centers'
  }
]

export default function InventoryPage() {
  const [inventoryData, setInventoryData] = useState([])
  const [locationData, setLocationData] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [totalStats, setTotalStats] = useState({
    totalUnits: 0,
    totalValue: 0,
    uniqueSkus: 0,
    lowStockItems: 0
  })
  const [searchDebounce, setSearchDebounce] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [createTransferOpen, setCreateTransferOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState(new Set()) // Track which groups are expanded
  const supabase = createClient()

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    loadInventoryData()
    // Clear selections when location changes
    setSelectedItems([])
  }, [searchDebounce, selectedLocation])

  const loadInventoryData = async () => {
    setLoading(true)
    try {
      // Build query params
      const params = new URLSearchParams()
      if (searchDebounce) params.append('sku', searchDebounce)
      if (selectedLocation !== 'all') params.append('location', selectedLocation)

      const response = await fetch(`/api/inventory?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load inventory')
      }

      // Transform location data for display
      const locationMap = {
        'Supplier Warehouse': 'supplier_warehouse',
        '3PL Warehouse': '3pl_warehouse',
        'Amazon FBA': 'amazon_fba',
        'Production': 'production'
      }

      // Debug raw API response
      console.log('Raw API response skus:', data.skus)
      
      // Transform SKU data to match the display format
      const transformedInventory = data.skus.map(sku => {
        const locations = {}
        
        // Initialize all locations with 0
        Object.values(locationMap).forEach(loc => {
          locations[loc] = { quantity: 0, value: 0 }
        })

        // Fill in actual quantities
        Object.entries(sku.locations).forEach(([location, quantity]) => {
          const mappedLocation = locationMap[location] || location.toLowerCase().replace(/\s+/g, '_')
          if (locations[mappedLocation]) {
            locations[mappedLocation].quantity = quantity
            // Calculate estimated value (you might want to fetch actual prices)
            locations[mappedLocation].value = quantity * 10 // Placeholder value calculation
          }
        })

        return {
          id: sku.sku,
          sku: sku.sku,
          product_name: sku.product_name,
          locations,
          total_quantity: sku.total_quantity,
          total_value: sku.total_quantity * 10, // Placeholder value calculation
          reorder_point: 200, // Default reorder point
          in_transit: 0, // Calculate from movements if needed
          unit_of_measure: sku.unit_of_measure,
          supplier_name: sku.supplier_name // Pass through supplier name from API
        }
      })

      setInventoryData(transformedInventory)
      setLocationData(data.locations || [])
      setMovements(data.movements || [])
      calculateTotalStats(transformedInventory)
      
      console.log('Loaded inventory data:', {
        skus: transformedInventory.length,
        locations: data.locations?.length || 0,
        movements: data.movements?.length || 0
      })
      
      if (data.movements?.length > 0) {
        console.log('Sample movement:', data.movements[0])
      }
      
      // Debug supplier data
      if (selectedLocation === 'supplier_warehouse') {
        console.log('Supplier warehouse items:', transformedInventory.filter(item => 
          item.locations.supplier_warehouse?.quantity > 0
        ).map(item => ({
          sku: item.sku,
          supplier_name: item.supplier_name,
          quantity: item.locations.supplier_warehouse?.quantity
        })))
      }
    } catch (error) {
      console.error('Error loading inventory:', error)
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalStats = (data) => {
    const stats = {
      totalUnits: data.reduce((sum, item) => sum + (item.total_quantity || 0), 0),
      totalValue: data.reduce((sum, item) => sum + (item.total_value || 0), 0),
      uniqueSkus: data.length,
      lowStockItems: data.filter(item => {
        const availableQty = (item.total_quantity || 0) - (item.in_transit || 0)
        return availableQty <= (item.reorder_point || 200)
      }).length
    }
    setTotalStats(stats)
  }

  const filteredInventory = inventoryData.filter(item => {
    const matchesSearch = !searchTerm || 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLocation = selectedLocation === 'all' || 
      (item.locations[selectedLocation]?.quantity > 0)
    
    return matchesSearch && matchesLocation
  })

  // Group inventory data by location
  const getGroupedInventory = () => {
    if (selectedLocation === 'all') {
      return { type: 'none', data: filteredInventory }
    }

    // Always group by location/supplier
    const grouped = {}
    filteredInventory.forEach(item => {
      let key = 'Default Location'
      
      // Determine grouping key based on selected location
      if (selectedLocation === 'supplier_warehouse') {
        key = item.supplier_name || 'Unknown Supplier'
      } else if (selectedLocation === 'production') {
        // For production, group by supplier (items come from purchase orders)
        key = item.supplier_name || 'Unknown Supplier'
      } else if (selectedLocation === '3pl_warehouse') {
        key = '3PL Warehouse'
      } else if (selectedLocation === 'amazon_fba') {
        key = 'Amazon FBA'
      }
      
      if (!grouped[key]) {
        grouped[key] = {
          location_name: key,
          items: [],
          totalQuantity: 0,
          skuCount: 0
        }
      }
      grouped[key].items.push(item)
      grouped[key].totalQuantity += item.locations[selectedLocation]?.quantity || 0
      grouped[key].skuCount += 1
    })
    return { 
      type: 'location', 
      data: Object.values(grouped).sort((a, b) => b.totalQuantity - a.totalQuantity)
    }
  }

  const groupedInventory = getGroupedInventory()
  
  // Expand all groups by default when grouped inventory changes
  useEffect(() => {
    if (groupedInventory.type === 'location' && groupedInventory.data.length > 0) {
      const allGroupNames = groupedInventory.data.map(g => g.location_name)
      setExpandedGroups(new Set(allGroupNames))
    }
  }, [groupedInventory.data.length, selectedLocation])

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = !searchTerm || 
      movement.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // Map selected location to actual location names
    let matchesLocation = selectedLocation === 'all'
    
    if (selectedLocation !== 'all') {
      const locationNameMap = {
        'production': 'Production',
        'supplier_warehouse': 'Supplier Warehouse',
        '3pl_warehouse': '3PL Warehouse',
        'amazon_fba': 'Amazon FBA'
      }
      
      const targetLocation = locationNameMap[selectedLocation]
      
      // Check if movement is TO or FROM the selected location
      // Also check for partial matches (e.g., "ABC Supplier Warehouse" matches "Supplier Warehouse")
      matchesLocation = 
        movement.from_location?.includes(targetLocation) ||
        movement.to_location?.includes(targetLocation) ||
        (targetLocation === 'Supplier Warehouse' && 
          (movement.from_location?.toLowerCase().includes('warehouse') ||
           movement.to_location?.toLowerCase().includes('warehouse')))
    }
    
    return matchesSearch && matchesLocation
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const getStockStatus = (item) => {
    const availableQty = item.total_quantity - item.in_transit
    if (availableQty <= 0) return { label: 'Out of Stock', color: 'destructive' }
    if (availableQty <= item.reorder_point) return { label: 'Low Stock', color: 'yellow' }
    return { label: 'In Stock', color: 'green' }
  }

  const handleSelectItem = (item, checked) => {
    if (checked) {
      // Check if we're in supplier warehouse and validate supplier consistency
      if (selectedLocation === 'supplier_warehouse' && selectedItems.length > 0) {
        const firstItemSupplier = selectedItems[0].supplier_name
        if (item.supplier_name !== firstItemSupplier) {
          toast.error(`Cannot select items from different suppliers. Currently selecting from ${firstItemSupplier || 'Unknown Supplier'}`)
          return
        }
      }
      setSelectedItems([...selectedItems, item])
    } else {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id))
    }
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      // Get all selectable items based on grouping
      let selectableItems = []
      
      if (groupedInventory.type === 'none') {
        selectableItems = filteredInventory.filter(item => {
          if (selectedLocation === 'all') return item.total_quantity > 0
          return (item.locations[selectedLocation]?.quantity || 0) > 0
        })
      } else {
        // For grouped views, get all items from all groups
        groupedInventory.data.forEach(group => {
          const items = group.items.filter(item => 
            (item.locations[selectedLocation]?.quantity || 0) > 0
          )
          selectableItems = selectableItems.concat(items)
        })
      }
      
      setSelectedItems(selectableItems)
    } else {
      setSelectedItems([])
    }
  }

  const toggleGroupExpanded = (groupName) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName)
    } else {
      newExpanded.add(groupName)
    }
    setExpandedGroups(newExpanded)
  }
  
  const expandAllGroups = () => {
    if (groupedInventory.type === 'location') {
      const allGroupNames = groupedInventory.data.map(g => g.location_name)
      setExpandedGroups(new Set(allGroupNames))
    }
  }
  
  const collapseAllGroups = () => {
    setExpandedGroups(new Set())
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Inventory
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Track inventory across all locations in your supply chain
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={loadInventoryData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Units</CardDescription>
            <CardTitle className="text-2xl">{totalStats.totalUnits.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Value</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalStats.totalValue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unique SKUs</CardDescription>
            <CardTitle className="text-2xl">{totalStats.uniqueSkus}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low Stock Items</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{totalStats.lowStockItems}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Location Pipeline */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Inventory Pipeline</CardTitle>
          <CardDescription>Visual overview of inventory flow through locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {locationStages.map((stage, index) => {
              const LocationIcon = stage.icon
              let locationTotal = 0
              
              // Map display labels to actual location names in data
              const locationNameMap = {
                'production': 'Production',
                'supplier_warehouse': 'Supplier Warehouse',
                '3pl_warehouse': '3PL Warehouse',
                'amazon_fba': 'Amazon FBA'
              }
              
              // Find matching location data
              const locationDataItem = locationData.find(loc => 
                loc.location === locationNameMap[stage.id]
              )
              
              if (locationDataItem) {
                locationTotal = locationDataItem.total_quantity
              } else {
                // Fallback to calculating from inventory data
                locationTotal = inventoryData.reduce((sum, item) => 
                  sum + (item.locations[stage.id]?.quantity || 0), 0
                )
              }
              
              return (
                <div key={stage.id} className="flex items-center">
                  <div 
                    className={`flex flex-col items-center p-4 rounded-lg border-2 min-w-[150px] cursor-pointer transition-all hover:shadow-md ${
                      selectedLocation === stage.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                    onClick={() => setSelectedLocation(stage.id === selectedLocation ? 'all' : stage.id)}
                  >
                    <LocationIcon className={`h-8 w-8 mb-2 text-${stage.color}-600`} />
                    <div className="text-sm font-medium text-center">{stage.label}</div>
                    <div className="text-2xl font-bold mt-1">{locationTotal.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">units</div>
                  </div>
                  {index < locationStages.length - 1 && (
                    <ArrowRight className="h-6 w-6 mx-2 text-slate-400" />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by SKU or product name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedLocation} onValueChange={setSelectedLocation}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {locationStages.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Transfer Action Button */}
      {selectedItems.length > 0 && selectedLocation !== 'all' && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              ({selectedItems.reduce((sum, item) => sum + (item.locations[selectedLocation]?.quantity || 0), 0)} units total)
            </span>
          </div>
          <Button
            onClick={() => setCreateTransferOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <ArrowRight className="h-4 w-4 mr-2" />
            Create Transfer
          </Button>
        </div>
      )}

      {/* Tabs for Inventory and Movements */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 dark:bg-slate-800">
            <TabsTrigger value="inventory" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400">
              Current Inventory
            </TabsTrigger>
            <TabsTrigger value="movements" className="data-[state=active]:bg-white data-[state=active]:text-slate-900 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100 data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-400">
              Recent Movements
            </TabsTrigger>
          </TabsList>
          {selectedLocation !== 'all' && groupedInventory.type === 'location' && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={expandAllGroups}
              >
                Expand All
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={collapseAllGroups}
              >
                Collapse All
              </Button>
            </div>
          )}
        </div>
        
        {/* Current Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0}
                  onCheckedChange={handleSelectAll}
                  disabled={selectedLocation === 'all'}
                />
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              {selectedLocation === 'all' ? (
                <>
                  <TableHead className="text-center">Production</TableHead>
                  <TableHead className="text-center">Supplier WH</TableHead>
                  <TableHead className="text-center">3PL WH</TableHead>
                  <TableHead className="text-center">Amazon FBA</TableHead>
                  <TableHead className="text-center">In Transit</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                </>
              ) : (
                <>
                  {selectedLocation === 'supplier_warehouse' && (
                    <TableHead>Supplier</TableHead>
                  )}
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                </>
              )}
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={selectedLocation === 'all' ? 11 : 7} className="text-center py-8">
                  Loading inventory data...
                </TableCell>
              </TableRow>
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={selectedLocation === 'all' ? 11 : 7} className="text-center py-8">
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-gray-500">No inventory found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : groupedInventory.type === 'none' ? (
              // Regular ungrouped view
              filteredInventory.map((item) => {
                const stockStatus = getStockStatus(item)
                
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedItems.some(i => i.id === item.id)}
                        onCheckedChange={(checked) => handleSelectItem(item, checked)}
                        disabled={
                          selectedLocation === 'all' || 
                          (item.locations[selectedLocation]?.quantity || 0) === 0
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    {selectedLocation === 'all' ? (
                      <>
                        <TableCell className="text-center">
                          {item.locations.production?.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.locations.supplier_warehouse?.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.locations['3pl_warehouse']?.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.locations.amazon_fba?.quantity || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.in_transit > 0 && (
                            <div className="flex items-center justify-center gap-1">
                              <Truck className="h-3 w-3 text-blue-600" />
                              {item.in_transit}
                            </div>
                          )}
                          {item.in_transit === 0 && '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.total_quantity.toLocaleString()}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        {selectedLocation === 'supplier_warehouse' && (
                          <TableCell className="text-sm">
                            {item.supplier_name || 'Unknown Supplier'}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">
                          {item.locations[selectedLocation]?.quantity.toLocaleString() || '0'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.unit_of_measure || 'units'}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.total_value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={stockStatus.color}>
                        {stockStatus.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : groupedInventory.type === 'location' ? (
              // Grouped by location view with expandable rows
              groupedInventory.data.map((group) => {
                const isExpanded = expandedGroups.has(group.location_name)
                return (
                  <React.Fragment key={group.location_name}>
                    <TableRow 
                      className="bg-slate-50 dark:bg-slate-900 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      onClick={() => toggleGroupExpanded(group.location_name)}
                    >
                      <TableCell>
                        <div className="flex items-center">
                          {isExpanded ? 
                            <ChevronDown className="h-4 w-4 text-slate-600" /> : 
                            <ChevronRight className="h-4 w-4 text-slate-600" />
                          }
                        </div>
                      </TableCell>
                      <TableCell colSpan={selectedLocation === 'supplier_warehouse' ? 3 : 2} className="text-base">
                        {group.location_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.totalQuantity.toLocaleString()} units
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {group.skuCount} SKUs
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                    {isExpanded && group.items.map((item) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <TableCell className="pl-8">
                          <Checkbox
                            checked={selectedItems.some(i => i.id === item.id)}
                            onCheckedChange={(checked) => handleSelectItem(item, checked)}
                            disabled={(item.locations[selectedLocation]?.quantity || 0) === 0}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm pl-8">{item.sku}</TableCell>
                        <TableCell className={selectedLocation === 'supplier_warehouse' ? "text-sm" : "text-sm"}>
                          {item.product_name}
                        </TableCell>
                        {selectedLocation === 'supplier_warehouse' && (
                          <TableCell className="text-sm text-muted-foreground">{item.supplier_name || 'Unknown'}</TableCell>
                        )}
                        <TableCell className="text-right">{item.locations[selectedLocation]?.quantity.toLocaleString() || '0'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{item.unit_of_measure || 'units'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.total_value)}</TableCell>
                        <TableCell>
                          <Badge variant={getStockStatus(item).color} className="text-xs">
                            {getStockStatus(item).label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                )
              })
            ) : null}
          </TableBody>
        </Table>
          </Card>
        </TabsContent>
        
        {/* Recent Movements Tab */}
        <TabsContent value="movements">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transfer #</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>PO #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <ArrowRight className="h-12 w-12 text-gray-400 mb-2" />
                        <p className="text-gray-500">No inventory movements found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.slice(0, 50).map((movement) => {
                    // Determine direction based on selected location
                    let direction = null
                    let directionBadge = null
                    
                    if (selectedLocation !== 'all') {
                      const locationNameMap = {
                        'production': 'Production',
                        'supplier_warehouse': 'Supplier Warehouse',
                        '3pl_warehouse': '3PL Warehouse',
                        'amazon_fba': 'Amazon FBA'
                      }
                      
                      const targetLocation = locationNameMap[selectedLocation]
                      const fromLower = movement.from_location?.toLowerCase() || ''
                      const toLower = movement.to_location?.toLowerCase() || ''
                      const targetLower = targetLocation.toLowerCase()
                      
                      // Check if movement is INTO or OUT OF the selected location
                      if (toLower.includes(targetLower) || 
                          (selectedLocation === 'supplier_warehouse' && toLower.includes('warehouse'))) {
                        direction = 'IN'
                        directionBadge = <Badge variant="green" className="flex items-center gap-1">
                          <ArrowDownToLine className="h-3 w-3" />
                          IN
                        </Badge>
                      } else if (fromLower.includes(targetLower) || 
                                 (selectedLocation === 'supplier_warehouse' && fromLower.includes('warehouse'))) {
                        direction = 'OUT'
                        directionBadge = <Badge variant="destructive" className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" />
                          OUT
                        </Badge>
                      }
                    } else {
                      // When showing all locations, show the transfer type
                      directionBadge = <Badge 
                        variant={
                          movement.transfer_type === 'in' ? 'green' :
                          movement.transfer_type === 'out' ? 'destructive' :
                          'blue'
                        }
                      >
                        {movement.transfer_type === 'in' ? 'Receive' :
                         movement.transfer_type === 'out' ? 'Ship Out' :
                         'Transfer'}
                      </Badge>
                    }
                    
                    return (
                      <TableRow key={movement.id}>
                        <TableCell className="text-sm">
                          {movement.transfer_date ? new Date(movement.transfer_date).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {movement.transfer_number}
                        </TableCell>
                        <TableCell>
                          {directionBadge}
                        </TableCell>
                      <TableCell className="font-mono text-sm">
                        {movement.sku}
                      </TableCell>
                      <TableCell>{movement.product_name}</TableCell>
                      <TableCell className="font-medium">
                        {movement.quantity} {movement.unit_of_measure}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.from_location || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.to_location || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {movement.po_number || '-'}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Transfer Sheet */}
      <CreateTransferSheet 
        open={createTransferOpen}
        onOpenChange={setCreateTransferOpen}
        selectedItems={selectedItems}
        fromLocation={selectedLocation}
        onSuccess={() => {
          setSelectedItems([])
          setCreateTransferOpen(false)
          loadInventoryData()
        }}
      />
    </div>
  )
}

// Create Transfer Sheet Component
function CreateTransferSheet({ open, onOpenChange, selectedItems, fromLocation, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [transferItems, setTransferItems] = useState([])
  const [toLocation, setToLocation] = useState('')
  const [notes, setNotes] = useState('')

  // Initialize transfer items when sheet opens
  useEffect(() => {
    if (open && selectedItems.length > 0) {
      setTransferItems(
        selectedItems.map(item => ({
          ...item,
          transferQuantity: item.locations[fromLocation]?.quantity || 0,
          maxQuantity: item.locations[fromLocation]?.quantity || 0
        }))
      )
    }
  }, [open, selectedItems, fromLocation])

  const locationNameMap = {
    'production': 'Production',
    'supplier_warehouse': 'Supplier Warehouse',
    '3pl_warehouse': '3PL Warehouse',
    'amazon_fba': 'Amazon FBA'
  }

  const fromLocationName = locationNameMap[fromLocation] || fromLocation

  // Get available destination locations based on source
  const getDestinationOptions = () => {
    if (fromLocation === 'production') {
      return ['supplier_warehouse']
    } else if (fromLocation === 'supplier_warehouse') {
      return ['3pl_warehouse', 'amazon_fba']
    } else if (fromLocation === '3pl_warehouse') {
      return ['amazon_fba']
    }
    return []
  }

  const handleQuantityChange = (itemId, newQuantity) => {
    setTransferItems(items =>
      items.map(item =>
        item.id === itemId
          ? { ...item, transferQuantity: Math.min(Math.max(0, newQuantity), item.maxQuantity) }
          : item
      )
    )
  }

  const handleSubmit = async () => {
    if (!toLocation) {
      toast.error('Please select a destination')
      return
    }

    const itemsToTransfer = transferItems.filter(item => item.transferQuantity > 0)
    
    if (itemsToTransfer.length === 0) {
      toast.error('Please enter quantities to transfer')
      return
    }

    setLoading(true)
    try {
      // Create individual transfers for each item (single line items)
      let successCount = 0
      let failedItems = []
      
      for (const item of itemsToTransfer) {
        // Generate unique transfer number for each item
        const timestamp = Date.now() + successCount
        const transferNumber = `TR-${timestamp.toString().slice(-6)}`
        
        // Include supplier info in from_location if from supplier warehouse
        let actualFromLocation = fromLocationName
        if (fromLocation === 'supplier_warehouse' && item.supplier_name) {
          actualFromLocation = `${item.supplier_name} (Warehouse)`
        }

        const transferData = {
          transfer_number: transferNumber,
          transfer_type: 'transfer',
          from_location: actualFromLocation,
          from_location_type: fromLocation,
          to_location: locationNameMap[toLocation],
          to_location_type: toLocation,
          status: 'completed',
          transfer_date: new Date().toISOString().split('T')[0],
          notes: notes ? `${notes} - ${item.sku}` : `Transfer of ${item.sku}`,
          items: [{
            sku: item.sku,
            product_name: item.product_name,
            quantity: item.transferQuantity,
            unit: item.unit_of_measure
          }]
        }

        try {
          const response = await fetch('/api/transfers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(transferData)
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Transfer error for', item.sku, ':', errorData)
            failedItems.push({ sku: item.sku, error: errorData.details || errorData.error })
          } else {
            successCount++
          }
        } catch (error) {
          console.error('Error creating transfer for', item.sku, ':', error)
          failedItems.push({ sku: item.sku, error: error.message })
        }
      }
      
      if (successCount > 0) {
        toast.success(`Created ${successCount} transfer${successCount > 1 ? 's' : ''} successfully`)
      }
      
      if (failedItems.length > 0) {
        const errorMessage = failedItems.map(item => `${item.sku}: ${item.error}`).join('\n')
        toast.error(`Failed to create ${failedItems.length} transfer${failedItems.length > 1 ? 's' : ''}:\n${errorMessage}`)
      }
      
      if (successCount > 0) {
        onSuccess()
      }
    } catch (error) {
      console.error('Error creating transfers:', error)
      toast.error('Failed to create transfers')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Create Transfer</SheetTitle>
          <SheetDescription>
            Transfer inventory from {fromLocationName}. Each SKU will create a separate transfer for better tracking.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6 space-y-6">
          {/* Destination Selection */}
          <div className="space-y-2">
            <Label htmlFor="destination">Destination</Label>
            <Select value={toLocation} onValueChange={setToLocation}>
              <SelectTrigger id="destination">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {getDestinationOptions().map(location => (
                  <SelectItem key={location} value={location}>
                    {locationNameMap[location]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items to Transfer */}
          <div className="space-y-3">
            <Label>Items to Transfer</Label>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {transferItems.map(item => (
                <div key={item.id} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{item.sku}</p>
                      <p className="text-sm text-muted-foreground">{item.product_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Max: {item.maxQuantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      max={item.maxQuantity}
                      value={item.transferQuantity}
                      onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">{item.unit_of_measure || 'units'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transfer"
            />
          </div>
        </div>

        <SheetFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : `Create ${transferItems.filter(item => item.transferQuantity > 0).length} Transfer${transferItems.filter(item => item.transferQuantity > 0).length !== 1 ? 's' : ''}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}