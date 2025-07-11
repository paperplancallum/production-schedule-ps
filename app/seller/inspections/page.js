'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreHorizontal, RefreshCw, Eye, Calendar, CheckCircle, XCircle, Clock, AlertCircle, ChevronRight, ChevronDown, Building, Package, Trash2, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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
  const router = useRouter()
  const [inspections, setInspections] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [inspectionToDelete, setInspectionToDelete] = useState(null)
  const supabase = createClient()

  useEffect(() => {
    fetchInspections()
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
            po_number,
            order_date,
            goods_ready_date,
            total_amount,
            supplier:vendors!supplier_id(
              id,
              vendor_name,
              email,
              phone,
              wechat,
              address,
              contact_name,
              country
            ),
            items:purchase_order_items(
              id,
              quantity,
              product:products(
                id,
                sku,
                product_name,
                unit_of_measure
              )
            )
          ),
          inspection_agent:vendors!inspection_agent_id(
            id,
            vendor_name,
            contact_name,
            email
          )
        `)
        .eq('seller_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching inspections:', error.message || 'Unknown error')
        console.error('Error code:', error.code)
        console.error('Full error:', JSON.stringify(error, null, 2))
        
        // If table doesn't exist, just show empty state
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.log('Inspections table not found, showing empty state')
          setInspections([])
          return
        }
        
        // If it's a column error, log it but continue
        if (error.code === '42703' || error.message?.includes('column')) {
          console.warn('Some columns may not exist in the database, continuing with partial data')
        }
        
        // For other errors, still show empty state but log the error
        setInspections([])
        return
      }

      // Group inspections by matching criteria (same agent, date, and notes)
      const groupedInspections = groupInspectionsByBatch(data || [])
      setInspections(groupedInspections)
    } catch (error) {
      console.error('Error in fetchInspections:', error)
      // Don't show error toast for missing table
      if (!error.message?.includes('relation') && !error.message?.includes('does not exist')) {
        toast.error('Failed to load inspections')
      }
      setInspections([])
    } finally {
      setLoading(false)
    }
  }

  const groupInspectionsByBatch = (inspections) => {
    const groups = []
    const processed = new Set()

    inspections.forEach(inspection => {
      if (processed.has(inspection.id)) return

      // Find all inspections with same agent, date, and notes (indicating they were scheduled together)
      const batch = inspections.filter(i => 
        i.inspection_agent_id === inspection.inspection_agent_id &&
        i.scheduled_date === inspection.scheduled_date &&
        i.notes === inspection.notes &&
        i.inspection_type === inspection.inspection_type &&
        // Check if they were created within 5 seconds of each other
        Math.abs(new Date(i.created_at) - new Date(inspection.created_at)) < 5000
      )

      // Mark all as processed
      batch.forEach(i => processed.add(i.id))

      // Use the first inspection as the main one, but include all purchase orders
      const groupedInspection = {
        ...inspection,
        purchase_orders: batch.map(i => i.purchase_order).filter(Boolean),
        inspection_numbers: batch.map(i => i.inspection_number),
        all_inspections: batch
      }

      groups.push(groupedInspection)
    })

    return groups
  }


  const toggleRowExpansion = (inspectionId) => {
    setExpandedRows(prev => 
      prev.includes(inspectionId) 
        ? prev.filter(id => id !== inspectionId)
        : [...prev, inspectionId]
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0)
  }

  const handleDeleteInspection = async () => {
    if (!inspectionToDelete) return

    try {
      // Delete all inspections in the batch
      const deletePromises = inspectionToDelete.all_inspections.map(inspection =>
        supabase
          .from('inspections')
          .delete()
          .eq('id', inspection.id)
      )

      const results = await Promise.all(deletePromises)
      
      // Check if any deletions failed
      const hasError = results.some(result => result.error)
      
      if (hasError) {
        throw new Error('Failed to delete some inspections')
      }

      toast.success('Inspection(s) deleted successfully')
      setDeleteDialogOpen(false)
      setInspectionToDelete(null)
      fetchInspections()
    } catch (error) {
      console.error('Error deleting inspection:', error)
      toast.error('Failed to delete inspection')
    }
  }

  const generateInspectionPDF = async (inspection) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()

    // Add header
    doc.setFontSize(20)
    doc.text('Inspection Report', 20, 20)
    
    // Add inspection details
    doc.setFontSize(12)
    doc.text(`Inspection Number: ${inspection.inspection_number}`, 20, 40)
    doc.text(`Date: ${inspection.scheduled_date ? new Date(inspection.scheduled_date).toLocaleDateString() : '-'}`, 20, 50)
    doc.text(`Status: ${statusConfig[inspection.status]?.label || inspection.status}`, 20, 60)
    doc.text(`Type: Post-Production`, 20, 70)
    
    // Add inspector info
    doc.text('Inspector:', 20, 90)
    doc.text(inspection.inspection_agent?.vendor_name || '-', 30, 100)
    if (inspection.inspection_agent?.contact_name) {
      doc.text(`Contact: ${inspection.inspection_agent.contact_name}`, 30, 110)
    }
    
    // Add supplier info
    const suppliers = inspection.purchase_orders?.length > 0
      ? [...new Map(
          inspection.purchase_orders
            .filter(po => po?.supplier)
            .map(po => [po.supplier.id, po.supplier])
        ).values()]
      : []
    
    let yPos = 130
    doc.text('Supplier(s):', 20, yPos)
    suppliers.forEach(supplier => {
      yPos += 10
      doc.text(`${supplier.vendor_name} (${supplier.country || '-'})`, 30, yPos)
    })
    
    // Add purchase orders with items
    yPos += 20
    doc.text('Purchase Orders & Items:', 20, yPos)
    const orders = inspection.purchase_orders?.length > 0 ? inspection.purchase_orders : [inspection.purchase_order]
    orders.forEach(po => {
      if (po) {
        yPos += 10
        doc.setFont(undefined, 'bold')
        doc.text(`${po.po_number}:`, 30, yPos)
        doc.setFont(undefined, 'normal')
        
        if (po.items && po.items.length > 0) {
          po.items.forEach(item => {
            yPos += 8
            doc.text(`${item.product?.sku || 'SKU'} - ${item.product?.product_name || 'Unknown'}: ${item.quantity} ${item.product?.unit_of_measure || 'units'}`, 40, yPos)
          })
        }
      }
    })
    
    // Add SKU summary
    yPos += 15
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Total Items to Inspect:', 20, yPos)
    doc.setFont(undefined, 'normal')
    doc.setFontSize(10)
    
    const skuTotals = {}
    orders.forEach(po => {
      po?.items?.forEach(item => {
        const sku = item.product?.sku || 'Unknown'
        if (!skuTotals[sku]) {
          skuTotals[sku] = {
            name: item.product?.product_name || 'Unknown',
            quantity: 0,
            unit: item.product?.unit_of_measure || 'units'
          }
        }
        skuTotals[sku].quantity += item.quantity
      })
    })
    
    Object.entries(skuTotals).forEach(([sku, data]) => {
      yPos += 8
      doc.text(`${sku} - ${data.name}: ${data.quantity} ${data.unit}`, 30, yPos)
    })
    
    // Add notes if any
    if (inspection.notes) {
      yPos += 20
      doc.setFontSize(12)
      doc.text('Notes:', 20, yPos)
      yPos += 10
      
      // Word wrap notes
      const splitNotes = doc.splitTextToSize(inspection.notes, 170)
      splitNotes.forEach(line => {
        doc.text(line, 20, yPos)
        yPos += 6
      })
    }
    
    // Save the PDF
    doc.save(`inspection-${inspection.inspection_number}.pdf`)
  }


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
          <p className="text-slate-600 mb-4">Schedule inspections from the Purchase Orders page</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Inspection #</TableHead>
                <TableHead>Purchase Order</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Inspector</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspections.map((inspection) => {
                const isExpanded = expandedRows.includes(inspection.id)
                const StatusIcon = statusConfig[inspection.status]?.icon || Clock
                const type = inspectionTypes.find(t => t.value === inspection.inspection_type)
                
                return (
                  <React.Fragment key={inspection.id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleRowExpansion(inspection.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {inspection.inspection_number}
                      </TableCell>
                      <TableCell>
                        {inspection.purchase_orders?.length > 1
                          ? `${inspection.purchase_orders.length} Orders`
                          : inspection.purchase_order?.po_number || '-'}
                      </TableCell>
                      <TableCell>{type?.label || '-'}</TableCell>
                      <TableCell>{inspection.inspection_agent?.vendor_name || '-'}</TableCell>
                      <TableCell>
                        {inspection.scheduled_date
                          ? new Date(inspection.scheduled_date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[inspection.status]?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig[inspection.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
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
                              onClick={() => generateInspectionPDF(inspection)}
                              className="cursor-pointer"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setInspectionToDelete(inspection)
                                setDeleteDialogOpen(true)
                              }}
                              className="cursor-pointer text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-transparent p-4">
                          <div className="bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm p-8">
                            {/* Header Section */}
                            <div className="mb-6 flex justify-between items-start">
                              <div>
                                <h3 className="text-lg font-semibold mb-2">Inspection Schedule</h3>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <div>Scheduled: {inspection.scheduled_date ? new Date(inspection.scheduled_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '-'}</div>
                                  <div>Status: <Badge variant={statusConfig[inspection.status]?.color} className="ml-1">
                                    {statusConfig[inspection.status]?.label}
                                  </Badge></div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground mb-1">Inspection Agency</div>
                                <div className="font-medium">{inspection.inspection_agent?.vendor_name || '-'}</div>
                                {inspection.inspection_agent?.contact_name && (
                                  <div className="text-sm text-muted-foreground">{inspection.inspection_agent.contact_name}</div>
                                )}
                              </div>
                            </div>

                            {/* Supplier Section */}
                            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                              <div className="text-sm font-medium mb-2 text-muted-foreground">SUPPLIER INFORMATION</div>
                              {(() => {
                                const suppliers = inspection.purchase_orders?.length > 0
                                  ? [...new Map(
                                      inspection.purchase_orders
                                        .filter(po => po?.supplier)
                                        .map(po => [po.supplier.id, po.supplier])
                                    ).values()]
                                  : [inspection.purchase_order?.supplier].filter(Boolean)
                                
                                return suppliers.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {suppliers.map((supplier, idx) => (
                                      <div key={supplier?.id || idx} className="space-y-2">
                                        <div className="font-medium text-base">{supplier?.vendor_name || '-'}</div>
                                        <div className="text-sm text-muted-foreground space-y-1">
                                          {supplier?.contact_name && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-xs font-medium min-w-[80px]">Contact:</span>
                                              <span>{supplier.contact_name}</span>
                                            </div>
                                          )}
                                          {supplier?.email && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-xs font-medium min-w-[80px]">Email:</span>
                                              <span>{supplier.email}</span>
                                            </div>
                                          )}
                                          {supplier?.phone && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-xs font-medium min-w-[80px]">Phone:</span>
                                              <span>{supplier.phone}</span>
                                            </div>
                                          )}
                                          {supplier?.wechat && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-xs font-medium min-w-[80px]">WeChat:</span>
                                              <span>{supplier.wechat}</span>
                                            </div>
                                          )}
                                          {supplier?.address && (
                                            <div className="flex items-start gap-2">
                                              <span className="text-xs font-medium min-w-[80px]">Address:</span>
                                              <div>
                                                <div>{supplier.address}</div>
                                                {supplier.country && <div>{supplier.country}</div>}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : <div className="text-muted-foreground">No supplier information</div>
                              })()}
                            </div>

                            {/* Purchase Orders Table */}
                            <div className="mb-6">
                              <div className="text-sm font-medium mb-3 text-muted-foreground">PURCHASE ORDERS</div>
                              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full">
                                  <thead className="bg-slate-50 dark:bg-slate-900 border-b">
                                    <tr>
                                      <th className="text-left p-3 text-sm font-medium">PO Number</th>
                                      <th className="text-left p-3 text-sm font-medium">Order Date</th>
                                      <th className="text-left p-3 text-sm font-medium">Goods Ready</th>
                                      <th className="text-left p-3 text-sm font-medium">Items to Inspect</th>
                                      <th className="text-center p-3 text-sm font-medium">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(inspection.purchase_orders?.length > 0 ? inspection.purchase_orders : [inspection.purchase_order]).map((po, idx) => (
                                      <tr key={po?.id || idx} className="border-b last:border-0">
                                        <td className="p-3 font-medium">{po?.po_number || '-'}</td>
                                        <td className="p-3 text-sm">{po?.order_date ? new Date(po.order_date).toLocaleDateString() : '-'}</td>
                                        <td className="p-3 text-sm">{po?.goods_ready_date ? new Date(po.goods_ready_date).toLocaleDateString() : '-'}</td>
                                        <td className="p-3 text-sm">
                                          {po?.items && po.items.length > 0 ? (
                                            <div className="space-y-1">
                                              {po.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className="text-xs">
                                                  <span className="font-medium">{item.product?.sku || 'SKU'}</span> - {item.product?.product_name || 'Unknown'}: {item.quantity} {item.product?.unit_of_measure || 'units'}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">No items</span>
                                          )}
                                        </td>
                                        <td className="p-3 text-center">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/seller/purchase-orders/${po?.id}`)}
                                          >
                                            View
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50 dark:bg-slate-900 border-t">
                                    <tr>
                                      <td colSpan={3} className="p-3 text-right font-medium">Total Items to Inspect:</td>
                                      <td className="p-3" colSpan={2}>
                                        <div className="space-y-1">
                                          {(() => {
                                            const skuTotals = {};
                                            const orders = inspection.purchase_orders?.length > 0 
                                              ? inspection.purchase_orders 
                                              : [inspection.purchase_order];
                                            
                                            orders.forEach(po => {
                                              po?.items?.forEach(item => {
                                                const sku = item.product?.sku || 'Unknown';
                                                if (!skuTotals[sku]) {
                                                  skuTotals[sku] = {
                                                    name: item.product?.product_name || 'Unknown',
                                                    quantity: 0,
                                                    unit: item.product?.unit_of_measure || 'units'
                                                  };
                                                }
                                                skuTotals[sku].quantity += item.quantity;
                                              });
                                            });
                                            
                                            return Object.entries(skuTotals).map(([sku, data]) => (
                                              <div key={sku} className="text-sm">
                                                <span className="font-medium">{sku}</span> - {data.name}: {data.quantity} {data.unit}
                                              </div>
                                            ));
                                          })()}
                                        </div>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>

                            {/* Notes Section */}
                            {inspection.notes && (
                              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <div className="text-sm font-medium mb-1 text-amber-800 dark:text-amber-200">Notes</div>
                                <div className="text-sm text-amber-700 dark:text-amber-300">{inspection.notes}</div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Inspection</DialogTitle>
            <DialogDescription>
              {inspectionToDelete?.purchase_orders?.length > 1 
                ? `This will delete all ${inspectionToDelete.purchase_orders.length} inspections in this batch. This action cannot be undone.`
                : 'Are you sure you want to delete this inspection? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteInspection}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}