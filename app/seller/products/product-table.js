'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, MoreHorizontal, RefreshCw, Pencil, Trash2, ChevronDown, ChevronRight, Star } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Component for the expanded row content
function ProductSuppliers({ productId, productName, onPriceUpdate }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddingSupplier, setIsAddingSupplier] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [newSupplier, setNewSupplier] = useState({
    vendor_id: '',
    lead_time_days: '',
    price_tiers: [{ minimum_order_quantity: '', unit_price: '', is_default: true }],
  })
  const [vendors, setVendors] = useState([])
  const [expandedSuppliers, setExpandedSuppliers] = useState({})
  const supabase = createClient()

  useEffect(() => {
    fetchSuppliers()
  }, [productId])

  useEffect(() => {
    fetchVendors()
  }, [productId, suppliers])

  const fetchSuppliers = async () => {
    try {
      setLoading(true)
      
      // First try to fetch with price tiers
      let { data, error } = await supabase
        .from('product_suppliers')
        .select(`
          *,
          vendors (
            id,
            vendor_name,
            vendor_type
          ),
          supplier_price_tiers (
            id,
            minimum_order_quantity,
            unit_price,
            is_default
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false })

      // If error mentions supplier_price_tiers, fetch without it
      if (error && error.message && error.message.includes('supplier_price_tiers')) {
        console.log('Price tiers table not available, fetching without tiers')
        const fallbackResult = await supabase
          .from('product_suppliers')
          .select(`
            *,
            vendors (
              id,
              vendor_name,
              vendor_type
            )
          `)
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
        
        data = fallbackResult.data
        error = fallbackResult.error
      }

      if (error) {
        console.error('Error fetching suppliers:', error)
        console.error('Error details:', error.message, error.details, error.hint)
        setSuppliers([])
        return
      }

      // Sort price tiers by MOQ for each supplier (if they exist)
      const suppliersWithSortedTiers = (data || []).map(supplier => ({
        ...supplier,
        supplier_price_tiers: supplier.supplier_price_tiers 
          ? (supplier.supplier_price_tiers || []).sort(
              (a, b) => a.minimum_order_quantity - b.minimum_order_quantity
            )
          : supplier.minimum_order_quantity && supplier.unit_price
            ? [{ 
                minimum_order_quantity: supplier.minimum_order_quantity, 
                unit_price: supplier.unit_price 
              }]
            : []
      }))

      setSuppliers(suppliersWithSortedTiers)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name, vendor_type')
        .eq('seller_id', userData.user.id)
        .eq('vendor_status', 'accepted')
        .eq('vendor_type', 'supplier')
        .order('vendor_name')

      if (!error && data) {
        // Filter out vendors that are already suppliers for this product
        const existingSupplierIds = suppliers.map(s => s.vendor_id)
        const availableVendors = data.filter(v => !existingSupplierIds.includes(v.id))
        setVendors(availableVendors)
      } else if (error) {
        console.error('Error fetching vendors:', error)
      }
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const handleAddSupplier = async (e) => {
    e.preventDefault()
    
    try {
      // Validate price tiers
      const validTiers = newSupplier.price_tiers.filter(
        tier => tier.minimum_order_quantity && tier.unit_price
      )
      
      if (validTiers.length === 0) {
        toast.error('Please add at least one price tier')
        return
      }

      // Create supplier first
      const supplierData = {
        product_id: productId,
        vendor_id: newSupplier.vendor_id,
        lead_time_days: parseInt(newSupplier.lead_time_days),
        // We'll use the first tier's values for backward compatibility
        minimum_order_quantity: parseInt(validTiers[0].minimum_order_quantity),
        unit_price: parseFloat(validTiers[0].unit_price),
        // If no suppliers exist, make this one primary
        is_primary: suppliers.length === 0,
      }

      const { data: supplierResult, error: supplierError } = await supabase
        .from('product_suppliers')
        .insert([supplierData])
        .select()
        .single()

      if (supplierError) {
        if (supplierError.code === '23505') {
          toast.error('This vendor is already a supplier for this product')
          return
        }
        throw supplierError
      }

      // Try to add price tiers - ensure only one is default
      const tierData = validTiers.map((tier, index) => ({
        product_supplier_id: supplierResult.id,
        minimum_order_quantity: parseInt(tier.minimum_order_quantity),
        unit_price: parseFloat(tier.unit_price),
        is_default: tier.is_default === true
      }))
      
      // Ensure at least one tier is default
      const hasDefault = tierData.some(t => t.is_default)
      if (!hasDefault && tierData.length > 0) {
        tierData[0].is_default = true
      }

      const { error: tierError } = await supabase
        .from('supplier_price_tiers')
        .insert(tierData)

      if (tierError) {
        // If price tiers table doesn't exist, just log warning and continue
        if (tierError.message && tierError.message.includes('supplier_price_tiers')) {
          console.warn('Price tiers table not available, supplier added without tiers')
        } else {
          // For other errors, rollback supplier
          await supabase
            .from('product_suppliers')
            .delete()
            .eq('id', supplierResult.id)
          throw tierError
        }
      }

      toast.success('Supplier added successfully')
      setIsAddingSupplier(false)
      setNewSupplier({
        vendor_id: '',
        lead_time_days: '',
        price_tiers: [{ minimum_order_quantity: '', unit_price: '', is_default: true }],
      })
      fetchSuppliers()
      // Refresh products if this was the first (primary) supplier
      if (suppliers.length === 0 && onPriceUpdate) {
        onPriceUpdate()
      }
    } catch (error) {
      console.error('Error adding supplier:', error)
      toast.error('Failed to add supplier')
    }
  }

  const handleEditSupplier = (supplier) => {
    setEditingSupplier(supplier)
    setNewSupplier({
      vendor_id: supplier.vendor_id,
      lead_time_days: supplier.lead_time_days.toString(),
      price_tiers: supplier.supplier_price_tiers && supplier.supplier_price_tiers.length > 0
        ? supplier.supplier_price_tiers.map(tier => ({
            id: tier.id,
            minimum_order_quantity: tier.minimum_order_quantity.toString(),
            unit_price: tier.unit_price.toString(),
            is_default: tier.is_default || false
          }))
        : [{ minimum_order_quantity: '', unit_price: '', is_default: true }]
    })
    setIsAddingSupplier(true)
  }

  const handleUpdateSupplier = async (e) => {
    e.preventDefault()
    
    try {
      // Validate price tiers
      const validTiers = newSupplier.price_tiers.filter(
        tier => tier.minimum_order_quantity && tier.unit_price
      )
      
      if (validTiers.length === 0) {
        toast.error('Please add at least one price tier')
        return
      }

      // Update supplier
      const supplierData = {
        lead_time_days: parseInt(newSupplier.lead_time_days),
        // We'll use the first tier's values for backward compatibility
        minimum_order_quantity: parseInt(validTiers[0].minimum_order_quantity),
        unit_price: parseFloat(validTiers[0].unit_price),
      }

      const { error: supplierError } = await supabase
        .from('product_suppliers')
        .update(supplierData)
        .eq('id', editingSupplier.id)

      if (supplierError) throw supplierError

      // Handle price tiers
      // First, check if price tiers table exists
      const { data: existingTiers, error: fetchError } = await supabase
        .from('supplier_price_tiers')
        .select('id')
        .eq('product_supplier_id', editingSupplier.id)

      if (!fetchError || !fetchError.message.includes('supplier_price_tiers')) {
        // Table exists, so we can manage tiers
        // Delete existing tiers
        if (existingTiers && existingTiers.length > 0) {
          await supabase
            .from('supplier_price_tiers')
            .delete()
            .eq('product_supplier_id', editingSupplier.id)
        }

        // Add new tiers - ensure only one is default
        const tierData = validTiers.map((tier, index) => ({
          product_supplier_id: editingSupplier.id,
          minimum_order_quantity: parseInt(tier.minimum_order_quantity),
          unit_price: parseFloat(tier.unit_price),
          is_default: tier.is_default === true
        }))
        
        // Ensure at least one tier is default
        const hasDefault = tierData.some(t => t.is_default)
        if (!hasDefault && tierData.length > 0) {
          tierData[0].is_default = true
        }

        const { error: tierError } = await supabase
          .from('supplier_price_tiers')
          .insert(tierData)

        if (tierError && !tierError.message.includes('supplier_price_tiers')) {
          throw tierError
        }
      }

      // If this is the primary supplier, update the product price with the default tier
      if (editingSupplier.is_primary) {
        const defaultTier = validTiers.find(t => t.is_default === true)
        if (defaultTier) {
          const { error: priceError } = await supabase
            .from('products')
            .update({ price: parseFloat(defaultTier.unit_price) })
            .eq('id', productId)
          
          if (priceError) {
            console.error('Error updating product price:', priceError)
          }
        }
      }

      toast.success('Supplier updated successfully')
      setIsAddingSupplier(false)
      setEditingSupplier(null)
      setNewSupplier({
        vendor_id: '',
        lead_time_days: '',
        price_tiers: [{ minimum_order_quantity: '', unit_price: '', is_default: true }],
      })
      fetchSuppliers()
      // Also refresh products to show updated price
      if (editingSupplier.is_primary && onPriceUpdate) {
        onPriceUpdate()
      }
    } catch (error) {
      console.error('Error updating supplier:', error)
      toast.error('Failed to update supplier')
    }
  }

  const handleMakePrimary = async (supplierId) => {
    try {
      // Update this supplier to be primary
      const { error } = await supabase
        .from('product_suppliers')
        .update({ is_primary: true })
        .eq('id', supplierId)

      if (error) throw error

      // Get the default tier price to update product
      const supplier = suppliers.find(s => s.id === supplierId)
      const defaultTier = supplier?.supplier_price_tiers?.find(t => t.is_default)
      
      if (defaultTier) {
        // Update product price
        const { error: productError } = await supabase
          .from('products')
          .update({ price: defaultTier.unit_price })
          .eq('id', productId)
        
        if (productError) {
          console.error('Error updating product price:', productError)
        } else {
          toast.success('Primary supplier set and product price updated')
        }
      } else {
        toast.success('Primary supplier set')
      }

      fetchSuppliers()
      // Refresh products to show updated price
      if (onPriceUpdate) {
        onPriceUpdate()
      }
    } catch (error) {
      console.error('Error setting primary supplier:', error)
      toast.error('Failed to set primary supplier')
    }
  }

  const handleDeleteSupplier = async (supplierId) => {
    if (!confirm('Are you sure you want to remove this supplier?')) return

    try {
      const { error } = await supabase
        .from('product_suppliers')
        .delete()
        .eq('id', supplierId)

      if (error) throw error

      toast.success('Supplier removed successfully')
      fetchSuppliers()
    } catch (error) {
      console.error('Error deleting supplier:', error)
      toast.error('Failed to remove supplier')
    }
  }

  return (
    <div className="px-8 py-4 bg-slate-50">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-sm font-medium text-slate-900">Suppliers for {productName}</h4>
        <Button
          size="sm"
          onClick={() => setIsAddingSupplier(true)}
        >
          <Plus className="mr-2 h-3 w-3" />
          Add Supplier
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-4">
          <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          No suppliers added yet
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="text-left p-2 font-medium text-slate-700"></th>
                <th className="text-left p-2 font-medium text-slate-700">Supplier Name</th>
                <th className="text-left p-2 font-medium text-slate-700">Lead Time (days)</th>
                <th className="text-left p-2 font-medium text-slate-700">Price Range</th>
                <th className="text-left p-2 font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, index) => (
                <React.Fragment key={supplier.id}>
                  <tr className={`bg-white ${index < suppliers.length - 1 || expandedSuppliers[supplier.id] ? 'border-b border-slate-100' : ''}`}>
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSuppliers(prev => ({ ...prev, [supplier.id]: !prev[supplier.id] }))}
                        className="h-6 w-6 p-0"
                      >
                        {expandedSuppliers[supplier.id] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </Button>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900">{supplier.vendors?.vendor_name || 'Unknown'}</span>
                        {supplier.is_primary ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Primary
                          </span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMakePrimary(supplier.id)}
                            className="h-6 px-2 text-xs hover:bg-slate-100"
                          >
                            Make Primary
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-slate-600">{supplier.lead_time_days} days</td>
                    <td className="p-2 text-slate-600">
                      {(() => {
                        const tiers = supplier.supplier_price_tiers || []
                        if (tiers.length === 0) return '-'
                        if (tiers.length === 1) return `$${parseFloat(tiers[0].unit_price).toFixed(2)}`
                        
                        const prices = tiers.map(t => parseFloat(t.unit_price))
                        const minPrice = Math.min(...prices)
                        const maxPrice = Math.max(...prices)
                        
                        return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
                      })()}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditSupplier(supplier)}
                          className="h-7 w-7 p-0 hover:bg-slate-100"
                        >
                          <Pencil className="h-3 w-3 text-slate-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="h-7 w-7 p-0 hover:bg-slate-100"
                        >
                          <Trash2 className="h-3 w-3 text-slate-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedSuppliers[supplier.id] && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="bg-slate-50 p-4">
                          <h5 className="text-sm font-medium text-slate-700 mb-2">Price Tiers</h5>
                          {supplier.supplier_price_tiers?.length > 0 ? (
                            <div className="space-y-1">
                              {supplier.supplier_price_tiers.map((tier, tierIndex) => (
                                <div key={tier.id} className="flex items-center gap-2 text-sm">
                                  <span className="text-slate-600">MOQ: {tier.minimum_order_quantity}</span>
                                  <span className="text-slate-900 font-medium">${parseFloat(tier.unit_price).toFixed(2)}/unit</span>
                                  {tier.is_default && (
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" title="Default tier" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">No price tiers defined</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={isAddingSupplier} onOpenChange={(open) => {
        setIsAddingSupplier(open)
        if (!open) {
          setEditingSupplier(null)
          setNewSupplier({
            vendor_id: '',
            lead_time_days: '',
            price_tiers: [{ minimum_order_quantity: '', unit_price: '' }],
          })
        }
      }}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</SheetTitle>
            <SheetDescription>
              {editingSupplier ? `Update supplier details for ${productName}` : `Add a supplier for ${productName}`}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={editingSupplier ? handleUpdateSupplier : handleAddSupplier} className="flex flex-col h-full">
            <div className="space-y-4 px-6 pt-4 pb-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Label>Supplier {editingSupplier && <span className="text-xs text-muted-foreground ml-2">(Cannot be changed)</span>}</Label>
                {editingSupplier ? (
                  <Input
                    value={editingSupplier.vendors?.vendor_name || 'Unknown'}
                    disabled
                    className="bg-gray-100"
                  />
                ) : (
                  <Select
                    value={newSupplier.vendor_id}
                    onValueChange={(value) => setNewSupplier({ ...newSupplier, vendor_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.length === 0 ? (
                        <SelectItem value="no-suppliers" disabled>
                          {suppliers.length > 0 ? 'All available suppliers have been added' : 'No suppliers available'}
                        </SelectItem>
                      ) : (
                        vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id}>
                            {vendor.vendor_name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead_time">Lead Time (days) *</Label>
                <Input
                  id="lead_time"
                  type="number"
                  value={newSupplier.lead_time_days}
                  onChange={(e) => setNewSupplier({ ...newSupplier, lead_time_days: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Price Tiers *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewSupplier({
                        ...newSupplier,
                        price_tiers: [...newSupplier.price_tiers, { minimum_order_quantity: '', unit_price: '', is_default: false }]
                      })
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tier
                  </Button>
                </div>
                <div className="space-y-2">
                  {newSupplier.price_tiers.map((tier, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newTiers = newSupplier.price_tiers.map((t, i) => ({
                            ...t,
                            is_default: i === index
                          }))
                          setNewSupplier({ ...newSupplier, price_tiers: newTiers })
                        }}
                        className="h-9 w-9 p-0"
                        title="Set as default tier"
                      >
                        <Star className={`h-4 w-4 ${tier.is_default ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                      </Button>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="MOQ"
                          value={tier.minimum_order_quantity}
                          onChange={(e) => {
                            const newTiers = [...newSupplier.price_tiers]
                            newTiers[index].minimum_order_quantity = e.target.value
                            setNewSupplier({ ...newSupplier, price_tiers: newTiers })
                          }}
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={tier.unit_price}
                          onChange={(e) => {
                            const newTiers = [...newSupplier.price_tiers]
                            newTiers[index].unit_price = e.target.value
                            setNewSupplier({ ...newSupplier, price_tiers: newTiers })
                          }}
                          required
                        />
                      </div>
                      {newSupplier.price_tiers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newTiers = newSupplier.price_tiers.filter((_, i) => i !== index)
                            // If we're removing the default tier, make the first one default
                            if (tier.is_default && newTiers.length > 0) {
                              newTiers[0].is_default = true
                            }
                            setNewSupplier({ ...newSupplier, price_tiers: newTiers })
                          }}
                          className="h-9 w-9 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500">Add price breaks based on minimum order quantity</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t">
              <Button type="submit" className="w-full">
                {editingSupplier ? 'Update Supplier' : 'Add Supplier'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

const columns = [
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
    accessorKey: 'product_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product Name" />
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('product_name')}</div>
    ),
  },
  {
    accessorKey: 'sku',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Internal SKU" />
    ),
    cell: ({ row }) => (
      <div className="text-slate-600">{row.getValue('sku') || '-'}</div>
    ),
  },
  {
    accessorKey: 'primary_supplier_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Primary Supplier" />
    ),
    cell: ({ row }) => {
      const supplierName = row.getValue('primary_supplier_name')
      return (
        <div className="text-slate-600">
          {supplierName || '-'}
        </div>
      )
    },
  },
  {
    accessorKey: 'price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    cell: ({ row }) => {
      const price = row.getValue('price')
      return (
        <div className="font-medium">
          {price ? `$${parseFloat(price).toFixed(2)}` : 'Set Primary Supplier'}
        </div>
      )
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('created_at')
      if (!date) return '-'
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const product = row.original
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
              onClick={() => table.options.meta?.onEditProduct(product)}
              className="cursor-pointer"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => table.options.meta?.onDeleteProduct(product.id)}
              className="cursor-pointer text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export function ProductTable() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [formData, setFormData] = useState({
    product_name: '',
    sku: '',
    price: '',
  })
  const [formErrors, setFormErrors] = useState({
    sku: '',
  })
  const supabase = createClient()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      if (userError || !userData.user) {
        throw new Error('User not authenticated')
      }

      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('id')
        .eq('id', userData.user.id)
        .single()

      if (sellerError || !sellerData) {
        console.error('Seller profile not found:', sellerError)
        // Products table might not exist yet
        setProducts([])
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_suppliers!left (
            is_primary,
            vendors (
              vendor_name
            )
          )
        `)
        .eq('seller_id', sellerData.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching products:', error)
        // If table doesn't exist, just show empty state
        if (error.code === '42P01') {
          setProducts([])
          return
        }
        throw error
      }

      // Process data to include primary supplier name
      const processedData = (data || []).map(product => ({
        ...product,
        primary_supplier_name: product.product_suppliers?.find(s => s.is_primary)?.vendors?.vendor_name || null
      }))

      setProducts(processedData)
    } catch (error) {
      console.error('Error fetching products:', error)
      // Don't show error toast for missing table
      if (!error.message?.includes('42P01')) {
        toast.error('Failed to fetch products', {
          description: 'Please try again.'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = async (e) => {
    e.preventDefault()
    setFormErrors({ sku: '' }) // Clear previous errors
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      if (userError || !userData.user) {
        throw new Error('User not authenticated')
      }

      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('id')
        .eq('id', userData.user.id)
        .single()

      if (sellerError || !sellerData) {
        throw new Error('Seller profile not found')
      }

      const productData = {
        product_name: formData.product_name,
        sku: formData.sku,
        seller_id: sellerData.id,
        price: formData.price ? parseFloat(formData.price) : null,
        status: 'active', // Default status
      }

      const { error } = await supabase.from('products').insert([productData])

      if (error) {
        // Check if it's a duplicate SKU error
        if (error.code === '23505' && error.message.includes('sku')) {
          setFormErrors({ sku: 'This Internal SKU already exists in your products, please use something different' })
          return
        }
        throw error
      }

      toast.success('Product added successfully')

      setIsAddingProduct(false)
      resetForm()
      setFormErrors({ sku: '' })
      fetchProducts()
    } catch (error) {
      console.error('Error adding product:', error)
      toast.error('Failed to add product', {
        description: error.message
      })
    }
  }

  const handleEditProduct = async (e) => {
    e.preventDefault()
    setFormErrors({ sku: '' }) // Clear previous errors
    
    try {
      const productData = {
        product_name: formData.product_name,
        sku: formData.sku,
        price: formData.price ? parseFloat(formData.price) : null,
      }

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)

      if (error) {
        // Check if it's a duplicate SKU error
        if (error.code === '23505' && error.message.includes('sku')) {
          setFormErrors({ sku: 'This Internal SKU already exists in your products, please use something different' })
          return
        }
        throw error
      }

      toast.success('Product updated successfully')

      setEditingProduct(null)
      resetForm()
      setFormErrors({ sku: '' })
      fetchProducts()
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error('Failed to update product', {
        description: error.message
      })
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)

      if (error) throw error

      toast.success('Product deleted successfully')

      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  const resetForm = () => {
    setFormData({
      product_name: '',
      sku: '',
      price: '',
    })
    setFormErrors({
      sku: '',
    })
  }

  const openEditSheet = (product) => {
    setFormData({
      product_name: product.product_name || '',
      sku: product.sku || '',
      price: product.price || '',
    })
    setFormErrors({
      sku: '',
    })
    setEditingProduct(product)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <Sheet open={isAddingProduct} onOpenChange={setIsAddingProduct}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Add New Product</SheetTitle>
                <SheetDescription>
                  Enter the details for your new product.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleAddProduct} className="flex flex-col h-full">
                <div className="space-y-4 px-6 pt-4 pb-4 flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="product_name">Product Name *</Label>
                    <Input
                      id="product_name"
                      value={formData.product_name}
                      onChange={(e) =>
                        setFormData({ ...formData, product_name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">Internal SKU *</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => {
                        setFormData({ ...formData, sku: e.target.value })
                        setFormErrors({ ...formErrors, sku: '' }) // Clear error on change
                      }}
                      required
                      className={formErrors.sku ? 'border-red-500' : ''}
                    />
                    {formErrors.sku && (
                      <p className="text-sm text-red-500 mt-1">{formErrors.sku}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      placeholder="Will be inherited from function"
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-muted-foreground">Price comes from primary supplier's default tier</p>
                  </div>
                </div>
                <div className="px-6 py-4 border-t">
                  <Button type="submit" className="w-full">
                    Add Product
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Sheet open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Product</SheetTitle>
            <SheetDescription>
              Update the product details.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEditProduct} className="flex flex-col h-full">
            <div className="space-y-4 px-6 pt-4 pb-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="edit_product_name">Product Name *</Label>
                <Input
                  id="edit_product_name"
                  value={formData.product_name}
                  onChange={(e) =>
                    setFormData({ ...formData, product_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_sku">Internal SKU *</Label>
                <Input
                  id="edit_sku"
                  value={formData.sku}
                  onChange={(e) => {
                    setFormData({ ...formData, sku: e.target.value })
                    setFormErrors({ ...formErrors, sku: '' }) // Clear error on change
                  }}
                  required
                  className={formErrors.sku ? 'border-red-500' : ''}
                />
                {formErrors.sku && (
                  <p className="text-sm text-red-500 mt-1">{formErrors.sku}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_price">Price</Label>
                <Input
                  id="edit_price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  placeholder="Will be inherited from function"
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-muted-foreground">Price comes from primary supplier's default tier</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t">
              <Button type="submit" className="w-full">
                Update Product
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-slate-100 p-4 mb-4">
            <Plus className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No products yet</h3>
          <p className="text-slate-600 mb-4">Get started by adding your first product</p>
          <Button onClick={() => setIsAddingProduct(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Product
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          searchKey="product_name"
          renderSubComponent={({ row }) => (
            <ProductSuppliers
              productId={row.original.id}
              productName={row.original.product_name}
              onPriceUpdate={fetchProducts}
            />
          )}
          meta={{
            onEditProduct: openEditSheet,
            onDeleteProduct: handleDeleteProduct,
          }}
        />
      )}
    </div>
  )
}