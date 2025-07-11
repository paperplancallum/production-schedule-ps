'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { Building, Warehouse, Package, Truck, Search, RefreshCw, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

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
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [totalStats, setTotalStats] = useState({
    totalUnits: 0,
    totalValue: 0,
    uniqueSkus: 0,
    lowStockItems: 0
  })
  const supabase = createClient()

  useEffect(() => {
    loadInventoryData()
  }, [])

  const loadInventoryData = async () => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      // Mock inventory data - in real implementation, this would aggregate from various sources
      const mockInventory = [
        {
          id: '1',
          sku: 'PROD-001',
          product_name: 'Widget A',
          locations: {
            production: { quantity: 1000, value: 5000 },
            supplier_warehouse: { quantity: 500, value: 2500 },
            '3pl_warehouse': { quantity: 200, value: 1000 },
            amazon_fba: { quantity: 100, value: 500 }
          },
          total_quantity: 1800,
          total_value: 9000,
          reorder_point: 300,
          in_transit: 150
        },
        {
          id: '2',
          sku: 'PROD-002',
          product_name: 'Widget B',
          locations: {
            production: { quantity: 0, value: 0 },
            supplier_warehouse: { quantity: 300, value: 1800 },
            '3pl_warehouse': { quantity: 400, value: 2400 },
            amazon_fba: { quantity: 50, value: 300 }
          },
          total_quantity: 750,
          total_value: 4500,
          reorder_point: 200,
          in_transit: 0
        },
        {
          id: '3',
          sku: 'PROD-003',
          product_name: 'Gadget X',
          locations: {
            production: { quantity: 2000, value: 20000 },
            supplier_warehouse: { quantity: 0, value: 0 },
            '3pl_warehouse': { quantity: 0, value: 0 },
            amazon_fba: { quantity: 150, value: 1500 }
          },
          total_quantity: 2150,
          total_value: 21500,
          reorder_point: 500,
          in_transit: 300
        }
      ]

      setInventoryData(mockInventory)
      calculateTotalStats(mockInventory)
    } catch (error) {
      console.error('Error loading inventory:', error)
      toast.error('Failed to load inventory data')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotalStats = (data) => {
    const stats = {
      totalUnits: data.reduce((sum, item) => sum + item.total_quantity, 0),
      totalValue: data.reduce((sum, item) => sum + item.total_value, 0),
      uniqueSkus: data.length,
      lowStockItems: data.filter(item => {
        const availableQty = item.total_quantity - item.in_transit
        return availableQty <= item.reorder_point
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
              const locationTotal = inventoryData.reduce((sum, item) => 
                sum + (item.locations[stage.id]?.quantity || 0), 0
              )
              
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

      {/* Inventory Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead className="text-center">Production</TableHead>
              <TableHead className="text-center">Supplier WH</TableHead>
              <TableHead className="text-center">3PL WH</TableHead>
              <TableHead className="text-center">Amazon FBA</TableHead>
              <TableHead className="text-center">In Transit</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Loading inventory data...
                </TableCell>
              </TableRow>
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  <div className="flex flex-col items-center">
                    <Package className="h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-gray-500">No inventory found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((item) => {
                const stockStatus = getStockStatus(item)
                
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
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
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}