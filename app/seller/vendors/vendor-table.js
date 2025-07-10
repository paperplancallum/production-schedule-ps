'use client'

import { useState } from 'react'
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const vendorTypes = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'inspection_agent', label: 'Inspection Agent' },
  { value: 'shipping_agent', label: 'Shipping Agent' }
]

const vendorStatuses = [
  { value: 'draft', label: 'Draft', className: 'bg-gray-100 text-gray-800' },
  { value: 'invited', label: 'Invited', className: 'bg-blue-100 text-blue-800' },
  { value: 'accepted', label: 'Accepted', className: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archived', className: 'bg-red-100 text-red-800' }
]

export default function VendorTable({ initialVendors, currentUserId }) {
  const router = useRouter()
  const [vendors, setVendors] = useState(initialVendors || [])
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newVendor, setNewVendor] = useState({
    vendorName: '',
    email: '',
    country: '',
    address: '',
    contactName: '',
    vendorType: ''
  })

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setNewVendor(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (value) => {
    setNewVendor(prev => ({
      ...prev,
      vendorType: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!newVendor.vendorType) {
      alert('Please select a vendor type')
      return
    }
    
    setIsSubmitting(true)
    
    const supabase = createClient()
    
    try {
      // Insert new vendor without an id (not linked to a profile yet)
      const vendorData = {
        seller_id: currentUserId,
        vendor_name: newVendor.vendorName,
        email: newVendor.email,
        country: newVendor.country,
        address: newVendor.address,
        contact_name: newVendor.contactName,
        vendor_type: newVendor.vendorType,
        vendor_status: 'draft' // New vendors start as draft
      }
      
      console.log('Inserting vendor data:', vendorData)
      
      const { data, error } = await supabase
        .from('vendors')
        .insert(vendorData)
        .select()
        .single()
      
      if (error) throw error
      
      // Update local state
      setVendors([...vendors, data])
      setIsAddVendorOpen(false)
      
      // Reset form
      setNewVendor({
        vendorName: '',
        email: '',
        country: '',
        address: '',
        contactName: '',
        vendorType: ''
      })
      
      // Refresh the page to get updated data
      router.refresh()
    } catch (error) {
      console.error('Error adding vendor:', error)
      // Better error message
      const errorMessage = error?.message || error?.error_description || 'Unknown error occurred'
      
      // Check if it's a table not found error
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        alert(`The vendors table needs to be set up. Please visit /setup-vendors to create it.`)
      } else {
        alert(`Failed to add vendor: ${errorMessage}`)
      }
      
      // Log more details for debugging
      console.log('Full error object:', {
        error,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns = [
    {
      accessorKey: "vendor_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vendor Name" />
      ),
      cell: ({ row }) => <div className="font-medium">{row.getValue("vendor_name")}</div>,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Email" />
      ),
    },
    {
      accessorKey: "country",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Country" />
      ),
    },
    {
      accessorKey: "address",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Address" />
      ),
    },
    {
      accessorKey: "contact_name",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Contact Name" />
      ),
    },
    {
      accessorKey: "vendor_type",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Vendor Type" />
      ),
      cell: ({ row }) => {
        const type = vendorTypes.find(t => t.value === row.getValue("vendor_type"))
        return (
          <Select defaultValue={row.getValue("vendor_type")} disabled>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vendorTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.getValue(id))
      },
    },
    {
      accessorKey: "vendor_status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = vendorStatuses.find(s => s.value === (row.getValue("vendor_status") || 'draft'))
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status?.className || 'bg-gray-100 text-gray-800'}`}>
            {status?.label || 'Draft'}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Vendors
          </h2>
          <p className="text-slate-600">
            Manage your vendor relationships
          </p>
        </div>
        <Button onClick={() => setIsAddVendorOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      <DataTable 
        columns={columns} 
        data={vendors} 
        searchKey="vendor_name"
      />

      <Sheet open={isAddVendorOpen} onOpenChange={setIsAddVendorOpen}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle>Add New Vendor</SheetTitle>
            <SheetDescription>
              Fill in the details below to add a new vendor to your network.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-4 px-6 pt-4 pb-4 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <Label htmlFor="vendorType">Vendor Type</Label>
                <Select
                  value={newVendor.vendorType}
                  onValueChange={handleSelectChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="vendorName">Vendor Name</Label>
                <Input
                  id="vendorName"
                  name="vendorName"
                  value={newVendor.vendorName}
                  onChange={handleInputChange}
                  placeholder="Enter vendor name"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={newVendor.email}
                  onChange={handleInputChange}
                  placeholder="vendor@example.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  value={newVendor.contactName}
                  onChange={handleInputChange}
                  placeholder="Contact person's name"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  name="country"
                  value={newVendor.country}
                  onChange={handleInputChange}
                  placeholder="Country"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  name="address"
                  value={newVendor.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                  required
                />
              </div>
            </div>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddVendorOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Vendor'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}