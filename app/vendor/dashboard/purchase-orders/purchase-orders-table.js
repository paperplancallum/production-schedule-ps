'use client'

import { Card } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export default function PurchaseOrdersTable({ vendorId }) {
  return (
    <Card>
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
            Purchase Orders
          </h3>
        </div>
      </div>

      <div className="p-12 text-center">
        <div className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-4">
          <FileText className="h-12 w-12" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
          No purchase orders yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You'll see purchase orders from your seller here
        </p>
      </div>
    </Card>
  )
}