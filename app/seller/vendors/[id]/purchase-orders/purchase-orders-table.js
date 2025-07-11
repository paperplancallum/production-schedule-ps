'use client'

import { FileText } from 'lucide-react'

export default function PurchaseOrdersTable({ vendorId }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Purchase Orders</h3>
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            onClick={() => {}}
          >
            Create Purchase Order
          </button>
        </div>
      </div>

      <div className="p-12 text-center">
        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
          <FileText className="h-12 w-12" />
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">
          No purchase orders yet
        </h3>
        <p className="text-sm text-gray-500">
          Create your first purchase order to get started
        </p>
      </div>
    </div>
  )
}