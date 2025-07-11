'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, Package, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'

const inspectionTypes = [
  { value: 'post_production', label: 'Post-Production' }
]

export default function ScheduleInspectionDialog({ open, onOpenChange, inspectionGroups, onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [inspectionAgents, setInspectionAgents] = useState([])
  const [formData, setFormData] = useState({})
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchInspectionAgents()
      initializeFormData()
    }
  }, [open, inspectionGroups])

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

  const initializeFormData = () => {
    if (!inspectionGroups) return

    const initialData = {}
    inspectionGroups.forEach((group, index) => {
      // Use the latest goods ready date as the inspection date
      const suggestedDate = group.latestGoodsReadyDate 
        ? new Date(group.latestGoodsReadyDate)
            .toISOString()
            .split('T')[0]
        : ''

      initialData[index] = {
        inspection_type: 'post_production',
        inspection_agent_id: '',
        scheduled_date: suggestedDate,
        notes: ''
      }
    })
    setFormData(initialData)
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        throw new Error('User not authenticated')
      }

      // Create inspections for each supplier group
      const inspectionPromises = inspectionGroups.map(async (group, index) => {
        const groupForm = formData[index]
        if (!groupForm.inspection_agent_id || !groupForm.scheduled_date) {
          throw new Error(`Please fill all required fields for ${group.supplier.vendor_name}`)
        }

        // Create one inspection per purchase order in the group
        const orderPromises = group.orders.map(order => 
          supabase
            .from('inspections')
            .insert({
              seller_id: userData.user.id,
              purchase_order_id: order.id,
              inspection_agent_id: groupForm.inspection_agent_id,
              inspection_type: groupForm.inspection_type,
              scheduled_date: groupForm.scheduled_date,
              notes: groupForm.notes,
              status: 'scheduled'
            })
            .select()
            .single()
        )

        return Promise.all(orderPromises)
      })

      await Promise.all(inspectionPromises)
      
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error scheduling inspections:', error)
      toast.error(error.message || 'Failed to schedule inspections')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Inspections</DialogTitle>
          <DialogDescription>
            Schedule quality inspections for the selected purchase orders, grouped by supplier
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {inspectionGroups?.map((group, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  {group.supplier.vendor_name}
                  <Badge variant="secondary">
                    {group.orders.length} {group.orders.length === 1 ? 'Order' : 'Orders'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Latest goods ready date: {formatDate(group.latestGoodsReadyDate)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Purchase Orders & Items:</span>
                  </div>
                  <div className="ml-6 space-y-3">
                    {group.orders.map(order => (
                      <div key={order.id} className="border-l-2 border-gray-200 pl-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{order.po_number}</span>
                          <span className="text-xs text-gray-500">
                            Ready: {formatDate(order.goods_ready_date)}
                          </span>
                        </div>
                        {order.items && order.items.length > 0 && (
                          <div className="space-y-1 text-xs">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-gray-600">
                                <span>
                                  {item.product?.sku || 'SKU'}: {item.product?.product_name || 'Unknown'}
                                </span>
                                <span className="font-medium">
                                  Qty: {item.quantity} {item.product?.unit_of_measure || 'units'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* SKU Summary */}
                  {group.skuSummary && Object.keys(group.skuSummary).length > 0 && (
                    <div className="mt-4 pt-3 border-t">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">Total Items to Inspect:</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        {Object.entries(group.skuSummary).map(([sku, data]) => (
                          <div key={sku} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">
                              {sku}: {data.name}
                            </span>
                            <span className="font-medium">
                              {data.quantity} {data.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Inspection Type *</Label>
                    <Select
                      value={formData[index]?.inspection_type || ''}
                      onValueChange={(value) => 
                        setFormData({ 
                          ...formData, 
                          [index]: { ...formData[index], inspection_type: value } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
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
                    <Label>Inspection Agency *</Label>
                    <Select
                      value={formData[index]?.inspection_agent_id || ''}
                      onValueChange={(value) => 
                        setFormData({ 
                          ...formData, 
                          [index]: { ...formData[index], inspection_agent_id: value } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select agency" />
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
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Scheduled Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData[index]?.scheduled_date || ''}
                    onChange={(e) => 
                      setFormData({ 
                        ...formData, 
                        [index]: { ...formData[index], scheduled_date: e.target.value } 
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Inspection scheduled for when goods are ready
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={formData[index]?.notes || ''}
                    onChange={(e) => 
                      setFormData({ 
                        ...formData, 
                        [index]: { ...formData[index], notes: e.target.value } 
                      })
                    }
                    placeholder="Additional requirements or notes..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {inspectionAgents.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No inspection agencies found. Please add inspection agent vendors first.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || inspectionAgents.length === 0}
          >
            {loading ? 'Scheduling...' : 'Schedule Inspections'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}