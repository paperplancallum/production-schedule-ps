import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function VendorDetailPage({ params }) {
  const supabase = await createClient()
  
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !vendor) {
    notFound()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {vendor.vendor_name} Overview
      </h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">Vendor Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{vendor.vendor_name}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Vendor Type</dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">{vendor.vendor_type}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Contact Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{vendor.contact_name || 'Not provided'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-sm text-gray-900">{vendor.email}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Country</dt>
            <dd className="mt-1 text-sm text-gray-900">{vendor.country || 'Not provided'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Address</dt>
            <dd className="mt-1 text-sm text-gray-900">{vendor.address || 'Not provided'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                vendor.vendor_status === 'accepted' 
                  ? 'bg-green-100 text-green-800' 
                  : vendor.vendor_status === 'invited'
                  ? 'bg-yellow-100 text-yellow-800'
                  : vendor.vendor_status === 'archived'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {vendor.vendor_status || 'draft'}
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}