'use client'

import { useState, useEffect } from 'react'
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
import { Plus, MoreHorizontal, RefreshCw, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

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
      <DataTableColumnHeader column={column} title="Internal SKU" />
    ),
    cell: ({ row }) => (
      <div className="text-slate-600">{row.getValue('sku') || '-'}</div>
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
          {price ? `$${parseFloat(price).toFixed(2)}` : 'Calculated'}
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
        product_name: formData.product_name,
        sku: formData.sku,
        seller_id: sellerData.id,
        price: formData.price ? parseFloat(formData.price) : null,
        status: 'active', // Default status
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
        product_name: formData.product_name,
        sku: formData.sku,
        price: formData.price ? parseFloat(formData.price) : null,
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
      price: '',
    })
  }

  const openEditSheet = (product) => {
    setFormData({
      product_name: product.product_name || '',
      sku: product.sku || '',
      price: product.price || '',
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
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      required
                    />
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
                    <p className="text-xs text-muted-foreground">Price will be calculated automatically</p>
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
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  required
                />
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
                <p className="text-xs text-muted-foreground">Price will be calculated automatically</p>
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
          meta={{
            onEditProduct: openEditSheet,
            onDeleteProduct: handleDeleteProduct,
          }}
        />
      )}
    </div>
  )
}