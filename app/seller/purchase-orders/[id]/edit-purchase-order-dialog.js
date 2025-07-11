'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'

export default function EditPurchaseOrderDialog({ 
  open, 
  onOpenChange, 
  order,
  onSuccess 
}) {
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [formData, setFormData] = useState({
    notes: '',
    trade_terms: 'FOB',
    items: []
  })

  useEffect(() => {
    if (order && open) {
      // Initialize form with current order data
      setFormData({
        notes: order.notes || '',
        trade_terms: order.trade_terms || 'FOB',
        items: order.items?.map(item => ({
          id: item.id,
          product_id: item.product_id || item.product?.id,
          product_supplier_id: item.product_supplier_id || item.product_supplier?.id,
          price_tier_id: item.price_tier_id || item.price_tier?.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          product: item.product,
          product_supplier: item.product_supplier,
          price_tier: item.price_tier,
          // For display purposes
          sku: item.product?.sku,
          product_name: item.product?.product_name
        })) || []
      })
      fetchProducts()
    }
  }, [order, open])

  const fetchProducts = async () => {
    if (!order?.supplier_id) return
    
    try {
      const response = await fetch(`/api/products/supplier/${order.supplier_id}`)
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, {
        product_id: '',
        product_supplier_id: '',
        price_tier_id: '',
        quantity: 1,
        unit_price: 0,
        product: null,
        product_supplier: null,
        price_tier: null
      }]
    })
  }

  const handleRemoveItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    
    if (field === 'product_id') {
      // Check if product is already in the order
      const isDuplicate = formData.items.some((item, i) => i !== index && item.product_id === value)
      if (isDuplicate) {
        alert('This product is already in the order. Please update the existing item instead.')
        return
      }
      
      const product = products.find(p => p.id === value)
      if (product) {
        const productSupplier = product.product_suppliers?.find(ps => ps.vendor_id === order.supplier_id)
        const defaultTier = productSupplier?.price_tiers?.[0]
        
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          product_supplier_id: productSupplier?.id || '',
          price_tier_id: defaultTier?.id || '',
          unit_price: defaultTier?.unit_price || 0,
          product: product,
          product_supplier: productSupplier,
          price_tier: defaultTier,
          sku: product.sku,
          product_name: product.product_name
        }
      }
    } else if (field === 'price_tier_id') {
      const productSupplier = newItems[index].product_supplier || 
        products.find(p => p.id === newItems[index].product_id)?.product_suppliers?.find(ps => ps.vendor_id === order.supplier_id)
      
      const tier = productSupplier?.price_tiers?.find(t => t.id === value)
      if (tier) {
        newItems[index] = {
          ...newItems[index],
          price_tier_id: tier.id,
          unit_price: tier.unit_price,
          price_tier: tier
        }
      }
    } else {
      newItems[index][field] = value
    }
    
    setFormData({ ...formData, items: newItems })
  }

  const validateForm = () => {
    if (formData.items.length === 0) {
      alert('Please add at least one item to the order')
      return false
    }

    for (const item of formData.items) {
      if (!item.product_id || item.quantity <= 0) {
        alert('Please select a product and enter a valid quantity for all items')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      // Calculate totals
      const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
      
      const response = await fetch(`/api/purchase-orders/${order.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: formData.notes,
          trade_terms: formData.trade_terms,
          subtotal: subtotal,
          total_amount: subtotal,
          items: formData.items.map(item => ({
            id: item.id, // Include ID for existing items
            product_id: item.product_id,
            product_supplier_id: item.product_supplier_id,
            price_tier_id: item.price_tier_id,
            quantity: parseInt(item.quantity),
            unit_price: parseFloat(item.unit_price),
            line_total: item.quantity * item.unit_price
          }))
        })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        onSuccess(updatedOrder)
        onOpenChange(false)
      } else {
        const error = await response.json()
        alert(`Error updating order: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating order:', error)
      alert('Failed to update order')
    } finally {
      setLoading(false)
    }
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  }

  const getPriceTiers = (item) => {
    // Try to get price tiers from the item's product_supplier
    if (item.product_supplier?.price_tiers) {
      return item.product_supplier.price_tiers
    }
    
    // Otherwise, find the product and get its supplier's price tiers
    const product = products.find(p => p.id === item.product_id)
    const productSupplier = product?.product_suppliers?.find(ps => ps.vendor_id === order.supplier_id)
    return productSupplier?.price_tiers || []
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Purchase Order {order?.po_number}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Trade Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="trade_terms">Trade Terms</Label>
              <Select
                value={formData.trade_terms}
                onValueChange={(value) => setFormData({ ...formData, trade_terms: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FOB">FOB</SelectItem>
                  <SelectItem value="CIF">CIF</SelectItem>
                  <SelectItem value="EXW">EXW</SelectItem>
                  <SelectItem value="DDP">DDP</SelectItem>
                  <SelectItem value="FCA">FCA</SelectItem>
                  <SelectItem value="CFR">CFR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Order Items</Label>
              <Button type="button" onClick={handleAddItem} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="grid grid-cols-2 gap-4 flex-1">
                      {/* Product Selection */}
                      <div>
                        <Label>Product</Label>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => handleItemChange(index, 'product_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product">
                              {item.sku && item.product_name ? `${item.sku} - ${item.product_name}` : 'Select product'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(product => {
                              const productSupplier = product.product_suppliers?.find(ps => ps.vendor_id === order.supplier_id)
                              if (!productSupplier) return null
                              
                              // Check if product is already in the order (but not the current item)
                              const isAlreadyInOrder = formData.items.some((orderItem, i) => 
                                i !== index && orderItem.product_id === product.id
                              )
                              
                              return (
                                <SelectItem 
                                  key={product.id} 
                                  value={product.id}
                                  disabled={isAlreadyInOrder}
                                >
                                  {product.sku} - {product.product_name}
                                  {productSupplier.moq && ` (MOQ: ${productSupplier.moq})`}
                                  {isAlreadyInOrder && ' (Already in order)'}
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Price Tier Selection */}
                      <div>
                        <Label>Price Tier</Label>
                        <Select
                          value={item.price_tier_id}
                          onValueChange={(value) => handleItemChange(index, 'price_tier_id', value)}
                          disabled={!item.product_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select price tier" />
                          </SelectTrigger>
                          <SelectContent>
                            {getPriceTiers(item).map(tier => (
                              <SelectItem key={tier.id} value={tier.id}>
                                {tier.minimum_order_quantity}+ units @ {formatCurrency(tier.unit_price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      {/* Unit Price */}
                      <div>
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right text-sm">
                    <span className="text-gray-500">Line Total: </span>
                    <span className="font-medium">{formatCurrency(item.quantity * item.unit_price)}</span>
                  </div>
                </div>
              ))}

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items added yet. Click "Add Item" to add products to this order.
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes or special instructions..."
              rows={3}
            />
          </div>

          {/* Total */}
          <div className="text-right pt-4 border-t">
            <div className="text-lg font-bold">
              Total: {formatCurrency(calculateTotal())}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}