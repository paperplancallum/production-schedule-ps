'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

export default function VendorProductsTable({ products }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Card>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <Input
              type="text"
              className="pl-10"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Your Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                MOQ
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Lead Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-200 dark:divide-slate-800">
            {filteredProducts.map((product) => {
              const supplierInfo = product.product_suppliers?.[0] || {}
              
              return (
                <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {product.image_url && (
                        <div className="flex-shrink-0 h-10 w-10 mr-3">
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {product.name}
                        </div>
                        {product.description && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {product.description.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {product.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    ${supplierInfo.price_per_unit || product.price}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {supplierInfo.moq || 1} units
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                    {supplierInfo.lead_time_days || 0} days
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.status === 'active' 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400' 
                        : product.status === 'draft'
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No products found
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}