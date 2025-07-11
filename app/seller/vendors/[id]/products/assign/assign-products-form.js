'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Image from 'next/image'
import { Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AssignProductsForm({ vendorId, vendorName, products, assignedProductIds }) {
  const router = useRouter()
  const [selectedProducts, setSelectedProducts] = useState(new Set(assignedProductIds))
  const [supplierInfo, setSupplierInfo] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleProductToggle = (productId) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
      // Remove supplier info for deselected product
      const newInfo = { ...supplierInfo }
      delete newInfo[productId]
      setSupplierInfo(newInfo)
    } else {
      newSelected.add(productId)
      // Initialize supplier info with defaults
      if (!supplierInfo[productId]) {
        setSupplierInfo({
          ...supplierInfo,
          [productId]: {
            price_per_unit: products.find(p => p.id === productId)?.price || 0,
            moq: 1,
            lead_time_days: 7
          }
        })
      }
    }
    setSelectedProducts(newSelected)
  }

  const handleSupplierInfoChange = (productId, field, value) => {
    setSupplierInfo({
      ...supplierInfo,
      [productId]: {
        ...supplierInfo[productId],
        [field]: value
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      // First, remove all existing assignments for this supplier
      const { error: deleteError } = await supabase
        .from('product_suppliers')
        .delete()
        .eq('vendor_id', vendorId)

      if (deleteError) throw deleteError

      // Then insert new assignments
      if (selectedProducts.size > 0) {
        const assignments = Array.from(selectedProducts).map(productId => ({
          product_id: productId,
          vendor_id: vendorId,
          lead_time_days: supplierInfo[productId]?.lead_time_days || 7,
          moq: supplierInfo[productId]?.moq || 1,
          is_primary: false
        }))

        console.log('Inserting assignments:', assignments)
        
        const { data: insertedData, error: insertError } = await supabase
          .from('product_suppliers')
          .insert(assignments)
          .select()

        console.log('Insert result:', { insertedData, insertError })
        
        if (insertError) throw insertError
      }

      toast.success('Products assigned successfully!')
      router.push(`/seller/vendors/${vendorId}/products`)
      router.refresh()
    } catch (error) {
      console.error('Error assigning products:', error)
      toast.error('Failed to assign products', {
        description: error.message
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <Link
          href={`/seller/vendors/${vendorId}/products`}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to products
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : 'Save Assignments'}
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            Available Products
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Select products and set supplier-specific pricing
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {products.map((product) => {
            const isSelected = selectedProducts.has(product.id)
            
            return (
              <div key={product.id} className={`p-4 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className="flex items-start space-x-4">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={isSelected}
                      onChange={() => handleProductToggle(product.id)}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      {product.image_url && (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {product.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          SKU: {product.sku} | Base Price: ${product.price}
                        </p>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Supplier Price
                          </label>
                          <div className="mt-1 relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 sm:text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-3 sm:text-sm border-gray-300 rounded-md"
                              value={supplierInfo[product.id]?.price_per_unit || product.price}
                              onChange={(e) => handleSupplierInfoChange(product.id, 'price_per_unit', parseFloat(e.target.value))}
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            MOQ (units)
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            value={supplierInfo[product.id]?.moq || 1}
                            onChange={(e) => handleSupplierInfoChange(product.id, 'moq', parseInt(e.target.value))}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Lead Time (days)
                          </label>
                          <input
                            type="number"
                            min="0"
                            className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                            value={supplierInfo[product.id]?.lead_time_days || 7}
                            onChange={(e) => handleSupplierInfoChange(product.id, 'lead_time_days', parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {products.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No active products available to assign.</p>
            <p className="mt-2 text-sm">
              Create some products first before assigning them to suppliers.
            </p>
          </div>
        )}
      </div>
    </form>
  )
}