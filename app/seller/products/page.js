'use client'

import { ProductTable } from './product-table'
import { SupplierTable } from './supplier-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ProductsPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Products
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your product catalog
        </p>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger 
            value="products"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100"
          >
            By Product
          </TabsTrigger>
          <TabsTrigger 
            value="suppliers"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100"
          >
            By Supplier
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="products" className="mt-6">
          <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
            <ProductTable />
          </div>
        </TabsContent>
        
        <TabsContent value="suppliers" className="mt-6">
          <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-6">
            <SupplierTable />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}