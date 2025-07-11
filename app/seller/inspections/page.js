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
import { Plus, MoreHorizontal, RefreshCw, Eye, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const statusConfig = {
  pending: { label: 'Pending', color: 'secondary', icon: Clock },
  scheduled: { label: 'Scheduled', color: 'blue', icon: Calendar },
  in_progress: { label: 'In Progress', color: 'yellow', icon: Clock },
  completed: { label: 'Completed', color: 'green', icon: CheckCircle },
  failed: { label: 'Failed', color: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'secondary', icon: XCircle }
}

const inspectionTypes = [
  { value: 'post_production', label: 'Post-Production' }
]

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAddingInspection, setIsAddingInspection] = useState(false)
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [inspectionAgents, setInspectionAgents] = useState([])
  const supabase = createClient()
  
  const [formData, setFormData] = useState({
    purchase_order_id: '',
    inspection_agent_id: '',
    inspection_type: '',
    scheduled_date: '',
    notes: ''
  })

  useEffect(() => {
    fetchInspections()
    fetchPurchaseOrders()
    fetchInspectionAgents()
  }, [])

  const fetchInspections = async () => {
    try {
      setLoading(true)
      const { data: userData } = await supabase.auth.getUser()
      
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('inspections')
        .select(`
          *,
          purchase_order:purchase_orders(
            id,
            po_number
          ),
          inspection_agent:vendors(
            id,
            vendor_name
          )
        `)
        .eq('seller_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching inspections:', error)
        // If table doesn't exist, just show empty state
        if (error.code === '42P01') {
          setInspections([])
          return
        }
        throw error
      }

      setInspections(data || [])
    } catch (error) {
      console.error('Error fetching inspections:', error)
      toast.error('Failed to load inspections')
    } finally {
      setLoading(false)
    }
  }

  const fetchPurchaseOrders = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data, error } = await supabase
        .from('purchase_orders')
        .select('id, po_number')
        .eq('seller_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setPurchaseOrders(data)
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    }
  }

  const fetchInspectionAgents = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return

      const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('seller_id', userData.user.id)
        .eq('vendor_type', 'inspection_agent')
        .eq('vendor_status', 'accepted')
        .order('vendor_name')

      if (!error && data) {
        setInspectionAgents(data)
      }
    } catch (error) {
      console.error('Error fetching inspection agents:', error)
    }
  }

  const handleAddInspection = async (e) => {
    e.preventDefault()
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('inspections')
        .insert({
          seller_id: userData.user.id,
          purchase_order_id: formData.purchase_order_id,
          inspection_agent_id: formData.inspection_agent_id,
          inspection_type: formData.inspection_type,
          scheduled_date: formData.scheduled_date,
          notes: formData.notes,
          status: 'scheduled'
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Inspection scheduled successfully!')
      setIsAddingInspection(false)
      setFormData({
        purchase_order_id: '',
        inspection_agent_id: '',
        inspection_type: '',
        scheduled_date: '',
        notes: ''
      })
      fetchInspections()
    } catch (error) {
      console.error('Error adding inspection:', error)
      toast.error('Failed to schedule inspection')
    }
  }

  const columns = [
    {
      accessorKey: 'inspection_number',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Inspection #" />
      ),
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('inspection_number')}</div>
      ),
    },
    {
      accessorKey: 'purchase_order',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Purchase Order" />
      ),
      cell: ({ row }) => {
        const po = row.getValue('purchase_order')
        return <div className="text-sm">{po?.po_number || '-'}</div>
      },
    },
    {
      accessorKey: 'inspection_type',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Type" />
      ),
      cell: ({ row }) => {
        const type = inspectionTypes.find(t => t.value === row.getValue('inspection_type'))
        return <div className="text-sm">{type?.label || '-'}</div>
      },
    },
    {
      accessorKey: 'inspection_agent',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Inspector" />
      ),
      cell: ({ row }) => {
        const agent = row.getValue('inspection_agent')
        return <div className="text-sm">{agent?.vendor_name || '-'}</div>
      },
    },
    {
      accessorKey: 'scheduled_date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Scheduled Date" />
      ),
      cell: ({ row }) => {
        const date = row.getValue('scheduled_date')
        if (!date) return '-'
        return new Date(date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        })
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => {
        const status = row.getValue('status')
        const config = statusConfig[status] || statusConfig.pending
        const Icon = config.icon
        
        return (
          <Badge variant={config.color}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const inspection = row.original
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
                onClick={() => toast.info('View inspection details')}
                className="cursor-pointer"
              >
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => toast.info('Download report')}
                className="cursor-pointer"
              >
                Download Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Inspections
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Manage quality inspections for your orders
        </p>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          <Sheet open={isAddingInspection} onOpenChange={setIsAddingInspection}>
            <SheetTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Inspection
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Schedule New Inspection</SheetTitle>
                <SheetDescription>
                  Schedule a quality inspection for a purchase order
                </SheetDescription>
              </SheetHeader>
              <form onSubmit={handleAddInspection} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="purchase_order">Purchase Order *</Label>
                  <Select
                    value={formData.purchase_order_id}
                    onValueChange={(value) => setFormData({ ...formData, purchase_order_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a purchase order" />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map(po => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.po_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspection_type">Inspection Type *</Label>
                  <Select
                    value={formData.inspection_type}
                    onValueChange={(value) => setFormData({ ...formData, inspection_type: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select inspection type" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspection_agent">Inspection Agency *</Label>
                  <Select
                    value={formData.inspection_agent_id}
                    onValueChange={(value) => setFormData({ ...formData, inspection_agent_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select inspection agency" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectionAgents.map(agent => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.vendor_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_date">Scheduled Date *</Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes or requirements..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Schedule Inspection
                </Button>
              </form>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchInspections}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : inspections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="rounded-full bg-slate-100 p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No inspections yet</h3>
            <p className="text-slate-600 mb-4">Schedule your first quality inspection</p>
            <Button onClick={() => setIsAddingInspection(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Inspection
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={inspections}
            searchKey="inspection_number"
          />
        )}
      </div>
    </div>
  )
}