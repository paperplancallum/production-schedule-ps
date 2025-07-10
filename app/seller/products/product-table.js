'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/ui/data-table'
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

const columns = [
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
      <DataTableColumnHeader column={column} title="SKU" />
    ),
    cell: ({ row }) => (
      <div className="text-slate-600">{row.getValue('sku') || '-'}</div>
    ),
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => (
      <div className="text-slate-600">{row.getValue('category') || '-'}</div>
    ),
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
          {price ? `$${parseFloat(price).toFixed(2)}` : '-'}
        </div>
      )
    },
  },
  {
    accessorKey: 'stock_quantity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Stock" />
    ),
    cell: ({ row }) => (
      <div className="text-center">{row.getValue('stock_quantity') || 0}</div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status')
      return (
        <Badge
          variant={
            status === 'active'
              ? 'default'
              : status === 'inactive'
              ? 'secondary'
              : 'outline'
          }
          className={
            status === 'active'
              ? 'bg-green-100 text-green-800 hover:bg-green-200'
              : status === 'inactive'
              ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
          }
        >
          {status}
        </Badge>
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
      return date ? format(new Date(date), 'MMM d, yyyy') : '-'
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
    description: '',
    category: '',
    price: '',
    cost: '',
    stock_quantity: 0,
    unit_of_measure: '',
    status: 'active',
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
        .select('*')
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

      setProducts(data || [])
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
        ...formData,
        seller_id: sellerData.id,
        price: formData.price ? parseFloat(formData.price) : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
      }

      const { error } = await supabase.from('products').insert([productData])

      if (error) throw error

      toast.success('Product added successfully')

      setIsAddingProduct(false)
      resetForm()
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
    try {
      const productData = {
        ...formData,
        price: formData.price ? parseFloat(formData.price) : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
      }

      const { error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', editingProduct.id)

      if (error) throw error

      toast.success('Product updated successfully')

      setEditingProduct(null)
      resetForm()
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
      description: '',
      category: '',
      price: '',
      cost: '',
      stock_quantity: 0,
      unit_of_measure: '',
      status: 'active',
    })
  }

  const openEditSheet = (product) => {
    setFormData({
      product_name: product.product_name || '',
      sku: product.sku || '',
      description: product.description || '',
      category: product.category || '',
      price: product.price || '',
      cost: product.cost || '',
      stock_quantity: product.stock_quantity || 0,
      unit_of_measure: product.unit_of_measure || '',
      status: product.status || 'active',
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
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Add New Product</SheetTitle>
                <SheetDescription>
                  Enter the details for your new product.
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleAddProduct} className="space-y-4 mt-4">
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
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) =>
                        setFormData({ ...formData, cost: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock_quantity">Stock Quantity</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stock_quantity: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit_of_measure">Unit of Measure</Label>
                    <Input
                      id="unit_of_measure"
                      value={formData.unit_of_measure}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          unit_of_measure: e.target.value,
                        })
                      }
                      placeholder="e.g., pcs, kg, lbs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Add Product
                </Button>
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
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Product</SheetTitle>
            <SheetDescription>
              Update the product details.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEditProduct} className="space-y-4 mt-4">
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
              <Label htmlFor="edit_sku">SKU</Label>
              <Input
                id="edit_sku"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_category">Category</Label>
              <Input
                id="edit_category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_cost">Cost</Label>
                <Input
                  id="edit_cost"
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_stock_quantity">Stock Quantity</Label>
                <Input
                  id="edit_stock_quantity"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_quantity: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_unit_of_measure">Unit of Measure</Label>
                <Input
                  id="edit_unit_of_measure"
                  value={formData.unit_of_measure}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unit_of_measure: e.target.value,
                    })
                  }
                  placeholder="e.g., pcs, kg, lbs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              Update Product
            </Button>
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
          meta={{
            onEditProduct: openEditSheet,
            onDeleteProduct: handleDeleteProduct,
          }}
        />
      )}
    </div>
  )
}