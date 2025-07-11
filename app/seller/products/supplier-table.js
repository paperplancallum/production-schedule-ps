'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, RefreshCw, ChevronDown, ChevronRight, FileText, Filter } from 'lucide-react'
import { toast } from 'sonner'
import SupplierFilters from './supplier-filters'

// Component for the expanded row content in supplier view
function SupplierProducts({ supplierId, supplierName, onCreatePO }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchSupplierProducts()
  }, [supplierId])

  const fetchSupplierProducts = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('product_suppliers')
        .select(`
          *,
          products (
            id,
            product_name,
            sku,
            price
          ),
          supplier_price_tiers (
            id,
            minimum_order_quantity,
            unit_price,
            is_default
          )
        `)
        .eq('vendor_id', supplierId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching supplier products:', error)
        setProducts([])
        return
      }

      // Sort price tiers by MOQ for each product
      const productsWithSortedTiers = (data || []).map(item => ({
        ...item,
        supplier_price_tiers: item.supplier_price_tiers 
          ? (item.supplier_price_tiers || []).sort(
              (a, b) => a.minimum_order_quantity - b.minimum_order_quantity
            )
          : []
      }))

      setProducts(productsWithSortedTiers)
    } catch (error) {
      console.error('Error fetching supplier products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-8 py-4 bg-slate-50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-slate-900">Products from {supplierName}</h4>
        {products.length > 0 && (
          <Button
            size="sm"
            onClick={() => {
              const productIds = products.map(p => p.products?.id).filter(Boolean)
              onCreatePO(productIds, supplierName)
            }}
          >
            <FileText className="mr-2 h-3 w-3" />
            Create PO for All Products
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No products from this supplier
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="text-left p-2 font-medium text-slate-700">Product Name</th>
                <th className="text-left p-2 font-medium text-slate-700">Internal SKU</th>
                <th className="text-left p-2 font-medium text-slate-700">Lead Time</th>
                <th className="text-left p-2 font-medium text-slate-700">MOQ</th>
                <th className="text-left p-2 font-medium text-slate-700">Price Range</th>
                <th className="text-left p-2 font-medium text-slate-700">Primary</th>
              </tr>
            </thead>
            <tbody>
              {products.map((item, index) => (
                <tr key={item.id} className={`bg-white ${index < products.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <td className="p-2 text-slate-900">{item.products?.product_name || 'Unknown'}</td>
                  <td className="p-2 text-slate-600">{item.products?.sku || '-'}</td>
                  <td className="p-2 text-slate-600">{item.lead_time_days} days</td>
                  <td className="p-2 text-slate-600">{item.moq || item.minimum_order_quantity || '-'}</td>
                  <td className="p-2 text-slate-600">
                    {(() => {
                      const tiers = item.supplier_price_tiers || []
                      if (tiers.length === 0) {
                        return item.unit_price ? `$${parseFloat(item.unit_price).toFixed(2)}` : '-'
                      }
                      if (tiers.length === 1) return `$${parseFloat(tiers[0].unit_price).toFixed(2)}`
                      
                      const prices = tiers.map(t => parseFloat(t.unit_price))
                      const minPrice = Math.min(...prices)
                      const maxPrice = Math.max(...prices)
                      
                      return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
                    })()}
                  </td>
                  <td className="p-2">
                    {item.is_primary && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                        Primary
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const supplierColumns = [
  {
    id: 'expander',
    header: () => null,
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => row.toggleExpanded()}
          className="h-8 w-8 p-0"
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      )
    },
  },
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'vendor_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Supplier Name" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('vendor_name')}</div>
    ),
  },
  {
    accessorKey: 'product_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Products" />
    ),
    cell: ({ row }) => {
      const count = row.getValue('product_count')
      return (
        <div className="text-slate-600">
          {count} {count === 1 ? 'product' : 'products'}
        </div>
      )
    },
  },
  {
    accessorKey: 'total_value',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Est. Total Value" />
    ),
    cell: ({ row }) => {
      const value = row.getValue('total_value')
      return (
        <div className="font-medium">
          {value ? `$${parseFloat(value).toFixed(2)}` : '-'}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const supplier = row.original
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                const productIds = supplier.products?.map(p => p.id) || []
                table.options.meta?.onCreatePO(productIds, supplier.vendor_name)
              }}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4" />
              Create PO
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function SupplierTable() {
  const [suppliers, setSuppliers] = useState([])
  const [filteredSuppliers, setFilteredSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState({})
  const [filters, setFilters] = useState([])
  const supabase = createClient()

  useEffect(() => {
    fetchSuppliers()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [suppliers, filters])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      if (userError || !userData.user) {
        throw new Error('User not authenticated')
      }

      // First get all suppliers with accepted status
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('seller_id', userData.user.id)
        .eq('vendor_status', 'accepted')
        .eq('vendor_type', 'supplier')

      if (vendorError) {
        console.error('Error fetching vendors:', vendorError)
        setSuppliers([])
        return
      }

      // Then get product supplier relationships with product details
      const { data: supplierData, error: supplierError } = await supabase
        .from('product_suppliers')
        .select(`
          vendor_id,
          is_primary,
          unit_price,
          moq,
          products (
            id,
            product_name,
            price
          )
        `)
        .in('vendor_id', vendorData.map(v => v.id))

      if (supplierError) {
        console.error('Error fetching product suppliers:', supplierError)
        setSuppliers([])
        return
      }

      // Group products by supplier and calculate metrics
      const supplierMap = new Map()
      
      vendorData.forEach(vendor => {
        supplierMap.set(vendor.id, {
          id: vendor.id,
          vendor_name: vendor.vendor_name,
          products: [],
          product_count: 0,
          total_value: 0
        })
      })

      supplierData.forEach(item => {
        const supplier = supplierMap.get(item.vendor_id)
        if (supplier && item.products) {
          supplier.products.push(item.products)
          supplier.product_count++
          // Use the supplier's unit price if available, otherwise use product price
          const price = item.unit_price || item.products.price || 0
          supplier.total_value += parseFloat(price)
        }
      })

      const suppliersArray = Array.from(supplierMap.values())
        .filter(s => s.product_count > 0) // Only show suppliers with products
        .sort((a, b) => b.product_count - a.product_count)

      setSuppliers(suppliersArray)
      setFilteredSuppliers(suppliersArray)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to fetch suppliers')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    if (!filters || (filters.filters && filters.filters.length === 0)) {
      setFilteredSuppliers(suppliers)
      return
    }

    // Handle both old format (array) and new format (object with filters and logic)
    const filterConditions = Array.isArray(filters) ? filters : (filters.filters || [])
    const logicOperator = filters.logic || 'and'

    const filtered = suppliers.filter(supplier => {
      // Check if supplier matches conditions based on logic operator
      const checkCondition = (condition) => {
        if (!condition.field || !condition.operator) return true

        const value = supplier[condition.field]
        const filterValue = condition.value

        // Handle date fields differently
        if (condition.field === 'created_at') {
          const dateValue = value ? new Date(value) : null
          const filterDate = filterValue ? new Date(filterValue) : null
          
          if (!dateValue) return condition.operator === 'is_empty'
          if (!filterDate && condition.operator !== 'is_empty' && condition.operator !== 'is_not_empty') return true
          
          // For date equality, compare only the date part (ignore time)
          const getDateOnly = (date) => {
            const d = new Date(date)
            d.setHours(0, 0, 0, 0)
            return d
          }
          
          switch (condition.operator) {
            case 'equals':
              return getDateOnly(dateValue).getTime() === getDateOnly(filterDate).getTime()
            case 'not_equals':
              return getDateOnly(dateValue).getTime() !== getDateOnly(filterDate).getTime()
            case 'greater_than':
              return dateValue > filterDate
            case 'less_than':
              return dateValue < filterDate
            case 'greater_or_equal':
              return dateValue >= filterDate
            case 'less_or_equal':
              return dateValue <= filterDate
            case 'is_empty':
              return !value
            case 'is_not_empty':
              return !!value
            default:
              return true
          }
        }
        
        // Handle other fields
        switch (condition.operator) {
          case 'contains':
            return value && value.toString().toLowerCase().includes(filterValue.toLowerCase())
          case 'not_contains':
            return !value || !value.toString().toLowerCase().includes(filterValue.toLowerCase())
          case 'equals':
            return value === filterValue
          case 'not_equals':
            return value !== filterValue
          case 'starts_with':
            return value && value.toString().toLowerCase().startsWith(filterValue.toLowerCase())
          case 'ends_with':
            return value && value.toString().toLowerCase().endsWith(filterValue.toLowerCase())
          case 'is_empty':
            return !value || value === ''
          case 'is_not_empty':
            return value && value !== ''
          case 'is_any_of':
            if (Array.isArray(filterValue)) {
              return filterValue.some(v => 
                value && value.toString().toLowerCase() === v.toLowerCase()
              )
            }
            return false
          case 'is_none_of':
            if (Array.isArray(filterValue)) {
              return !filterValue.some(v => 
                value && value.toString().toLowerCase() === v.toLowerCase()
              )
            }
            return true
          default:
            return true
        }
      }
      
      // Apply logic operator (AND or OR)
      if (logicOperator === 'or') {
        return filterConditions.some(checkCondition)
      } else {
        return filterConditions.every(checkCondition)
      }
    })

    setFilteredSuppliers(filtered)
  }

  const handleCreatePO = (productIds, supplierName) => {
    if (!productIds || productIds.length === 0) {
      toast.error('No products available for this supplier')
      return
    }
    
    toast.info(`Please go to the Purchase Orders page to create a new PO for ${supplierName}`)
    
    // Clear selection after showing message
    setSelectedRows({})
  }

  return (
    <div>
      <SupplierFilters 
        onFiltersChange={setFilters}
      />
      
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={fetchSuppliers}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">No suppliers with products</h3>
          <p className="text-slate-600">Add products and assign suppliers to see them here</p>
        </div>
      ) : (
        <DataTable
          columns={supplierColumns}
          data={filteredSuppliers}
          renderSubComponent={({ row }) => (
            <SupplierProducts
              supplierId={row.original.id}
              supplierName={row.original.vendor_name}
              onCreatePO={handleCreatePO}
            />
          )}
          rowSelection={selectedRows}
          onRowSelectionChange={setSelectedRows}
          meta={{
            onCreatePO: handleCreatePO,
          }}
        />
      )}
    </div>
  )
}