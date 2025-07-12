'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CreatePurchaseOrderDialog({ open, onOpenChange, onSuccess, defaultSupplierId, defaultProducts = [] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [supplierProducts, setSupplierProducts] = useState([])
  
  // Form state
  const [formData, setFormData] = useState({
    supplier_id: defaultSupplierId || '',
    notes: '',
    trade_terms: 'FOB' // Default trade term
  })
  
  // Items state
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState({
    product_id: '',
    quantity: 1,
    unit_price: 0,
    notes: ''
  })

  // Load suppliers on mount
  useEffect(() => {
    loadSuppliers()
  }, [])

  // Set default supplier when provided
  useEffect(() => {
    if (defaultSupplierId && open) {
      setFormData(prev => ({ ...prev, supplier_id: defaultSupplierId }))
    }
  }, [defaultSupplierId, open])

  // Load products when supplier is selected
  useEffect(() => {
    if (formData.supplier_id) {
      loadSupplierProducts(formData.supplier_id)
    } else {
      setSupplierProducts([])
      setItems([])
    }
  }, [formData.supplier_id])

  // Pre-fill items when defaultProducts are provided
  useEffect(() => {
    if (defaultProducts.length > 0 && supplierProducts.length > 0 && open) {
      const prefilledItems = []
      
      defaultProducts.forEach(product => {
        // Find the product_supplier record
        const productSupplier = supplierProducts.find(sp => sp.product?.id === product.id)
        
        if (productSupplier) {
          // Get the default price tier or first tier
          const defaultTier = productSupplier.price_tiers?.find(tier => tier.is_default) || 
                             productSupplier.price_tiers?.[0]
          
          prefilledItems.push({
            product_supplier_id: productSupplier.id,
            product_id: product.id,
            product: productSupplier.product || product, // Include the full product object
            quantity: Math.max(productSupplier.moq || 1, 1), // Start with MOQ but allow editing
            unit_price: defaultTier?.unit_price || 0,
            price_tier_id: defaultTier?.id || null,
            moq: productSupplier.moq,
            lead_time_days: productSupplier.lead_time_days
          })
        }
      })
      
      if (prefilledItems.length > 0) {
        setItems(prefilledItems)
      }
    }
  }, [defaultProducts, supplierProducts, open])

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Reset form after a small delay to avoid flashing
      setTimeout(() => {
        setFormData({
          supplier_id: '',
          notes: '',
          trade_terms: 'FOB'
        })
        setItems([])
        setNewItem({
          product_id: '',
          quantity: 1,
          unit_price: 0,
          notes: ''
        })
        setError('')
      }, 200)
    }
  }, [open])

  const loadSuppliers = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('User not authenticated')
      return
    }
    
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('vendor_type', 'supplier')
      .eq('vendor_status', 'accepted')
      .eq('seller_id', user.id)
      .order('vendor_name')

    if (error) {
      console.error('Error loading suppliers:', error)
      setError('Failed to load suppliers')
    } else {
      setSuppliers(data || [])
    }
  }

  const loadSupplierProducts = async (supplierId) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('product_suppliers')
      .select(`
        *,
        product:products(*),
        price_tiers:supplier_price_tiers(*)
      `)
      .eq('vendor_id', supplierId)
      .order('product(product_name)')

    if (error) {
      console.error('Error loading supplier products:', error)
      setError('Failed to load products')
    } else {
      setSupplierProducts(data || [])
    }
  }

  const handleProductSelect = (productSupplierId) => {
    const productSupplier = supplierProducts.find(ps => ps.id === productSupplierId)
    if (productSupplier) {
      // Find default price tier or use price_per_unit
      const defaultTier = productSupplier.price_tiers?.find(tier => tier.is_default)
      const unitPrice = defaultTier?.unit_price || productSupplier.price_per_unit || 0
      
      // Get supplier MOQ
      const supplierMOQ = productSupplier.moq || 0
      
      // Set quantity to default tier's MOQ or supplier MOQ
      const defaultQuantity = defaultTier?.minimum_order_quantity || supplierMOQ || 1
      
      setNewItem({
        ...newItem,
        product_id: productSupplier.product.id,
        product_supplier_id: productSupplierId,
        quantity: defaultQuantity,
        unit_price: unitPrice,
        product: productSupplier.product,
        price_tier_id: defaultTier?.id
      })
    }
  }

  const handleQuantityChange = (quantity) => {
    const productSupplier = supplierProducts.find(ps => ps.id === newItem.product_supplier_id)
    if (productSupplier && productSupplier.price_tiers?.length > 0) {
      // Find appropriate price tier based on quantity
      const applicableTier = productSupplier.price_tiers
        .filter(tier => tier.minimum_order_quantity <= quantity)
        .sort((a, b) => b.minimum_order_quantity - a.minimum_order_quantity)[0]
      
      if (applicableTier) {
        setNewItem({
          ...newItem,
          quantity,
          unit_price: applicableTier.unit_price,
          price_tier_id: applicableTier.id
        })
      } else {
        setNewItem({ ...newItem, quantity })
      }
    } else {
      setNewItem({ ...newItem, quantity })
    }
  }

  const addItem = () => {
    if (!newItem.product_supplier_id || newItem.quantity <= 0) {
      setError('Please select a product and enter a valid quantity')
      return
    }

    // Check if product already exists in items
    if (items.some(item => item.product_supplier_id === newItem.product_supplier_id)) {
      setError('This product is already in the order')
      return
    }

    // Check MOQ validation
    const productSupplier = supplierProducts.find(ps => ps.id === newItem.product_supplier_id)
    if (productSupplier) {
      // Check supplier MOQ only
      const supplierMOQ = productSupplier.moq || 0
      
      if (supplierMOQ > 0 && newItem.quantity < supplierMOQ) {
        setError(`Quantity must be at least ${supplierMOQ} units (MOQ) for ${productSupplier.product.product_name}`)
        return
      }
    }

    setItems([...items, { ...newItem }])
    setNewItem({
      product_id: '',
      product_supplier_id: '',
      quantity: 1,
      unit_price: 0,
      notes: ''
    })
    setError('')
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const handleSubmit = async () => {
    if (!formData.supplier_id) {
      setError('Please select a supplier')
      return
    }

    if (items.length === 0) {
      setError('Please add at least one item to the order')
      return
    }

    // Validate MOQ for all items
    for (const item of items) {
      const productSupplier = supplierProducts.find(ps => ps.id === item.product_supplier_id)
      const moq = productSupplier?.moq || 0
      if (moq > 0 && item.quantity < moq) {
        setError(`${item.product?.product_name} quantity must be at least ${moq} units (MOQ)`)
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: items.map(item => ({
            product_id: item.product_id,
            product_supplier_id: item.product_supplier_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            price_tier_id: item.price_tier_id,
            notes: item.notes
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create purchase order')
      }

      if (onSuccess) {
        onSuccess(data)
      }
      
      // Reset form
      setFormData({
        supplier_id: '',
        notes: '',
        trade_terms: 'FOB'
      })
      setItems([])
      onOpenChange(false)
      
      // Redirect to purchase orders page with highlight
      router.push(`/seller/purchase-orders?highlight=${data.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Create a new purchase order for your supplier
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="supplier">Supplier *</Label>
              {items.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('This will clear all items and reset the form. Continue?')) {
                      setItems([])
                      setFormData({ supplier_id: '', notes: '' })
                      setNewItem({
                        product_id: '',
                        product_supplier_id: '',
                        quantity: 1,
                        unit_price: 0,
                        notes: ''
                      })
                    }
                  }}
                >
                  Clear Form
                </Button>
              )}
            </div>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
              disabled={items.length > 0}
            >
              <SelectTrigger disabled={items.length > 0}>
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.vendor_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {items.length > 0 && (
              <p className="text-sm text-slate-500">
                Supplier cannot be changed after adding items. Use &quot;Clear Form&quot; to start over.
              </p>
            )}
          </div>


          {/* Items Section */}
          {formData.supplier_id && (
            <div className="space-y-4">
              <h3 className="font-semibold">Order Items</h3>
              
              {/* Add Item Form */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Product</Label>
                  <Select
                    value={newItem.product_supplier_id}
                    onValueChange={handleProductSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a product" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierProducts
                        .filter(ps => !items.find(item => item.product_supplier_id === ps.id))
                        .map(ps => (
                          <SelectItem key={ps.id} value={ps.id}>
                            {ps.product.product_name} - {ps.product.sku}
                          </SelectItem>
                        ))
                      }
                      {supplierProducts.filter(ps => !items.find(item => item.product_supplier_id === ps.id)).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-slate-500">
                          All products have been added
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 0)}
                    min={(() => {
                      const ps = supplierProducts.find(p => p.id === newItem.product_supplier_id)
                      const moq = ps?.moq || 1
                      return moq
                    })()}
                    placeholder={(() => {
                      const ps = supplierProducts.find(p => p.id === newItem.product_supplier_id)
                      const moq = ps?.moq || 0
                      return moq > 1 ? `Min ${moq}` : ''
                    })()}
                  />
                </div>
                <div className="w-32">
                  <Label>Unit Price</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <Input
                      type="number"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem({ ...newItem, unit_price: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      className="pl-6"
                    />
                  </div>
                </div>
                <Button onClick={addItem} size="sm" type="button">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* MOQ Pricing Tiers Display */}
              {newItem.product_supplier_id && (() => {
                const selectedSupplier = supplierProducts.find(ps => ps.id === newItem.product_supplier_id)
                const priceTiers = selectedSupplier?.price_tiers || []
                const supplierMOQ = selectedSupplier?.moq || 0
                
                return (
                  <div className="mt-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                    {supplierMOQ > 0 && (
                      <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded">
                        <p className="text-sm font-medium text-amber-800">
                          Minimum Order Quantity: {supplierMOQ} units
                        </p>
                      </div>
                    )}
                    {priceTiers.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-slate-700 mb-2">Price Tiers for {selectedSupplier?.product?.product_name}:</p>
                      <div className="space-y-1">
                        {priceTiers
                          .sort((a, b) => a.minimum_order_quantity - b.minimum_order_quantity)
                          .map((tier, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600">
                                {tier.minimum_order_quantity}+ units
                                {tier.is_default && <span className="ml-2 text-xs text-blue-600">(default)</span>}
                              </span>
                              <span className="font-medium text-slate-900">
                                ${parseFloat(tier.unit_price).toFixed(2)}/unit
                              </span>
                            </div>
                          ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Price will automatically update based on quantity entered
                      </p>
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Items Table */}
              {items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>
                        <div className="flex items-center gap-1">
                          <span>Price Tiers</span>
                          <span className="text-xs font-normal text-slate-500">(qty for savings)</span>
                        </div>
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product?.product_name}</TableCell>
                        <TableCell>{item.product?.sku}</TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => {
                                const newQuantity = parseInt(e.target.value) || 1
                                const updatedItems = [...items]
                                updatedItems[index] = {
                                  ...item,
                                  quantity: newQuantity
                                }
                                
                                // Update price tier based on new quantity
                                const productSupplier = supplierProducts.find(ps => ps.id === item.product_supplier_id)
                                if (productSupplier?.price_tiers?.length > 0) {
                                  const applicableTier = productSupplier.price_tiers
                                    .filter(tier => newQuantity >= tier.minimum_order_quantity)
                                    .sort((a, b) => b.minimum_order_quantity - a.minimum_order_quantity)[0]
                                  
                                  if (applicableTier) {
                                    updatedItems[index].unit_price = applicableTier.unit_price
                                    updatedItems[index].price_tier_id = applicableTier.id
                                  }
                                }
                                
                                setItems(updatedItems)
                              }}
                              className="w-24 text-right"
                            />
                            {(() => {
                              const productSupplier = supplierProducts.find(ps => ps.id === item.product_supplier_id)
                              const moq = productSupplier?.moq || 0
                              if (moq > 0 && item.quantity < moq) {
                                return (
                                  <span className="text-xs text-red-500">
                                    Min: {moq}
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${item.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${(item.quantity * item.unit_price).toFixed(2)}</TableCell>
                        <TableCell>
                          {(() => {
                            const productSupplier = supplierProducts.find(ps => ps.id === item.product_supplier_id)
                            const tiers = productSupplier?.price_tiers || []
                            if (tiers.length > 0) {
                              const sortedTiers = tiers.sort((a, b) => a.minimum_order_quantity - b.minimum_order_quantity)
                              const applicableTier = sortedTiers
                                .filter(tier => item.quantity >= tier.minimum_order_quantity)
                                .sort((a, b) => b.minimum_order_quantity - a.minimum_order_quantity)[0]
                              
                              return (
                                <div className="space-y-1">
                                  <div className="text-xs space-y-1">
                                    {sortedTiers.map((tier, idx) => {
                                      const isActive = tier.id === applicableTier?.id
                                      const couldApply = item.quantity >= tier.minimum_order_quantity
                                      
                                      return (
                                        <div 
                                          key={idx} 
                                          className={`flex items-center gap-1 ${
                                            isActive 
                                              ? 'font-medium text-blue-600' 
                                              : couldApply 
                                                ? 'text-slate-600' 
                                                : 'text-slate-400'
                                          }`}
                                        >
                                          {isActive && <span className="text-xs">→</span>}
                                          <span className={!isActive ? 'ml-3' : ''}>
                                            {tier.minimum_order_quantity.toLocaleString()}+ @ ${tier.unit_price}
                                          </span>
                                          {!isActive && !couldApply && tier.minimum_order_quantity > item.quantity && (
                                            <span className="text-xs text-slate-400">
                                              (+{(tier.minimum_order_quantity - item.quantity).toLocaleString()})
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                  {(() => {
                                    // Show potential savings
                                    const nextTier = sortedTiers.find(tier => tier.minimum_order_quantity > item.quantity)
                                    if (nextTier && applicableTier) {
                                      const currentTotal = item.quantity * applicableTier.unit_price
                                      const nextTotal = nextTier.minimum_order_quantity * nextTier.unit_price
                                      const unitSavings = applicableTier.unit_price - nextTier.unit_price
                                      if (unitSavings > 0) {
                                        return (
                                          <div className="text-xs text-green-600 font-medium mt-1 pt-1 border-t">
                                            Save ${unitSavings.toFixed(2)}/unit at {nextTier.minimum_order_quantity.toLocaleString()}+
                                          </div>
                                        )
                                      }
                                    }
                                    return null
                                  })()}
                                </div>
                              )
                            }
                            return <span className="text-xs text-slate-400">-</span>
                          })()}
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() => removeItem(index)}
                            size="sm"
                            variant="ghost"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className="space-y-2 border-t pt-4">
            <div className="text-right">
              <div className="font-semibold text-lg">
                Total: ${calculateSubtotal().toFixed(2)}
              </div>
            </div>
          </div>

          {/* Trade Terms */}
          <div className="space-y-2">
            <Label htmlFor="trade_terms">Trade Terms</Label>
            <Select
              value={formData.trade_terms}
              onValueChange={(value) => setFormData({ ...formData, trade_terms: value })}
            >
              <SelectTrigger id="trade_terms">
                <SelectValue placeholder="Select trade terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOB">FOB (Free On Board)</SelectItem>
                <SelectItem value="CIF">CIF (Cost, Insurance & Freight)</SelectItem>
                <SelectItem value="EXW">EXW (Ex Works)</SelectItem>
                <SelectItem value="DDP">DDP (Delivered Duty Paid)</SelectItem>
                <SelectItem value="FCA">FCA (Free Carrier)</SelectItem>
                <SelectItem value="CFR">CFR (Cost and Freight)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional notes for the supplier"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !formData.supplier_id || items.length === 0}>
            {loading ? 'Creating...' : 'Create Purchase Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}