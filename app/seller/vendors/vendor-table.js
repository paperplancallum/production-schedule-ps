'use client'

import { useState } from 'react'
import { toast } from 'sonner'
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
import { Plus, Mail, Loader2, MoreHorizontal, Trash2, Edit2, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const vendorTypes = [
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'inspection_agent', label: 'Inspection Agent' },
  { value: 'shipping_agent', label: 'Shipping Agent' }
]

const vendorStatuses = [
  { value: 'draft', label: 'Draft', className: 'bg-gray-100 text-gray-800' },
  { value: 'invited', label: 'Invited to Join', className: 'bg-yellow-100 text-yellow-800' },
  { value: 'accepted', label: 'Accepted', className: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archived', className: 'bg-red-100 text-red-800' }
]

export default function VendorTable({ initialVendors, currentUserId }) {
  const router = useRouter()
  const [vendors, setVendors] = useState(initialVendors || [])
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [invitingVendorId, setInvitingVendorId] = useState(null)
  const [deletingVendorId, setDeletingVendorId] = useState(null)
  const [editingVendor, setEditingVendor] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const supabase = createClient()
      const { data: refreshedVendors, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('seller_id', currentUserId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setVendors(refreshedVendors || [])
      toast.success('Vendors list refreshed')
    } catch (error) {
      console.error('Error refreshing vendors:', error)
      toast.error('Failed to refresh vendors', {
        description: error.message
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSelectChange = (value) => {
    setNewVendor(prev => ({
      ...prev,
      vendorType: value
    }))
  }

  const handleDeleteVendor = async (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId)
    if (!confirm(`Are you sure you want to delete ${vendor?.vendor_name}? This action cannot be undone.`)) {
      return
    }
    
    setDeletingVendorId(vendorId)
    
    try {
      const supabase = createClient()
      
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId)
      
      if (error) throw error
      
      // Update local state
      setVendors(vendors.filter(v => v.id !== vendorId))
      
      toast.success('Vendor deleted successfully')
      
      // Refresh to get updated data
      router.refresh()
    } catch (error) {
      console.error('Error deleting vendor:', error)
      toast.error('Failed to delete vendor', {
        description: error.message
      })
    } finally {
      setDeletingVendorId(null)
    }
  }
  
  const handleEditVendor = (vendor) => {
    setEditingVendor(vendor)
    setNewVendor({
      vendorName: vendor.vendor_name,
      email: vendor.email,
      country: vendor.country || '',
      address: vendor.address || '',
      contactName: vendor.contact_name || '',
      vendorType: vendor.vendor_type
    })
    setIsAddVendorOpen(true)
  }

  const handleInviteVendor = async (vendorId) => {
    setInvitingVendorId(vendorId)
    
    try {
      const response = await fetch('/api/vendors/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vendorId }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite vendor')
      }
      
      // Update local state to reflect new status
      setVendors(vendors.map(v => 
        v.id === vendorId 
          ? { ...v, vendor_status: 'invited' }
          : v
      ))
      
      // Refresh to get updated data
      router.refresh()
      
      if (data.warning) {
        // Email failed but status updated
        if (data.invitationUrl) {
          // Show a toast with ability to copy the invitation link
          toast.warning(data.warning, {
            description: 'Click below to copy the invitation link and send it manually.',
            action: {
              label: 'Copy invitation link',
              onClick: () => {
                navigator.clipboard.writeText(data.invitationUrl)
                toast.success('Invitation link copied to clipboard!', {
                  description: `Send this link to ${data.vendorEmail}`
                })
              }
            },
            duration: 10000 // Keep it visible longer
          })
        } else {
          toast.warning(data.warning)
        }
      } else {
        toast.success('Invitation sent successfully!', {
          description: `An invitation email has been sent to ${vendors.find(v => v.id === vendorId)?.email}`
        })
      }
    } catch (error) {
      console.error('Error inviting vendor:', error)
      toast.error('Failed to invite vendor', {
        description: error.message
      })
    } finally {
      setInvitingVendorId(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate required fields
    if (!newVendor.vendorType) {
      toast.error('Please select a vendor type')
      return
    }
    
    setIsSubmitting(true)
    
    const supabase = createClient()
    
    try {
      const vendorData = {
        vendor_name: newVendor.vendorName,
        email: newVendor.email,
        country: newVendor.country,
        address: newVendor.address,
        contact_name: newVendor.contactName,
        vendor_type: newVendor.vendorType,
      }
      
      let data
      
      if (editingVendor) {
        // Update existing vendor
        const { data: updatedData, error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', editingVendor.id)
          .select()
          .single()
        
        if (error) throw error
        data = updatedData
        
        // Update local state
        setVendors(vendors.map(v => v.id === editingVendor.id ? data : v))
      } else {
        // Insert new vendor
        const { data: newData, error } = await supabase
          .from('vendors')
          .insert({
            ...vendorData,
            seller_id: currentUserId,
            vendor_status: 'draft' // New vendors start as draft
          })
          .select()
          .single()
        
        if (error) throw error
        data = newData
        
        // Update local state
        setVendors([...vendors, data])
      }
      
      setIsAddVendorOpen(false)
      setEditingVendor(null)
      
      // Reset form
      setNewVendor({
        vendorName: '',
        email: '',
        country: '',
        address: '',
        contactName: '',
        vendorType: ''
      })
      
      // Show success message
      if (editingVendor) {
        toast.success('Vendor updated successfully!', {
          description: `${data.vendor_name} has been updated.`
        })
      } else {
        toast.success('Vendor added successfully!', {
          description: `${data.vendor_name} has been added as a ${data.vendor_type.replace('_', ' ')}.`
        })
      }
      
      // Refresh the page to get updated data
      router.refresh()
    } catch (error) {
      console.error('Error adding vendor:', error)
      // Better error message
      const errorMessage = error?.message || error?.error_description || 'Unknown error occurred'
      
      // Check if it's a table not found error
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        toast.error('Database table not found', {
          description: 'The vendors table needs to be set up. Please visit /setup-vendors to create it.',
          action: {
            label: 'Go to setup',
            onClick: () => window.location.href = '/setup-vendors'
          }
        })
      } else {
        toast.error('Failed to add vendor', {
          description: errorMessage
        })
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
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const vendor = row.original
        const isInviting = invitingVendorId === vendor.id
        const isDeleting = deletingVendorId === vendor.id
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0"
                disabled={isInviting || isDeleting}
              >
                <span className="sr-only">Open menu</span>
                {isInviting || isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleEditVendor(vendor)}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              {vendor.vendor_status === 'draft' && (
                <DropdownMenuItem 
                  onClick={() => handleInviteVendor(vendor.id)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Invite Vendor
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={() => handleDeleteVendor(vendor.id)}
                className="text-red-600"
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddVendorOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={vendors} 
        searchKey="vendor_name"
      />

      <Sheet open={isAddVendorOpen} onOpenChange={(open) => {
        setIsAddVendorOpen(open)
        if (!open) {
          setEditingVendor(null)
          setNewVendor({
            vendorName: '',
            email: '',
            country: '',
            address: '',
            contactName: '',
            vendorType: ''
          })
        }
      }}>
        <SheetContent className="sm:max-w-[540px]">
          <SheetHeader>
            <SheetTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</SheetTitle>
            <SheetDescription>
              {editingVendor 
                ? 'Update the vendor details below.' 
                : 'Fill in the details below to add a new vendor to your network.'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="space-y-4 px-6 pt-4 pb-4 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <Label htmlFor="vendorType">
                  Vendor Type
                  {editingVendor && (
                    <span className="text-xs text-muted-foreground ml-2">(Cannot be changed)</span>
                  )}
                </Label>
                <Select
                  value={newVendor.vendorType}
                  onValueChange={handleSelectChange}
                  required
                  disabled={!!editingVendor}
                >
                  <SelectTrigger disabled={!!editingVendor}>
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
                {isSubmitting ? (editingVendor ? 'Updating...' : 'Adding...') : (editingVendor ? 'Update Vendor' : 'Add Vendor')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}