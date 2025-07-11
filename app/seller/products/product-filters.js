'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { X, Plus, Trash2, Filter, Check, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const FIELD_OPTIONS = [
  { value: 'product_name', label: 'Product Name', type: 'text' },
  { value: 'sku', label: 'Internal SKU', type: 'text' },
  { value: 'primary_supplier_name', label: 'Primary Supplier', type: 'text' },
  { value: 'price', label: 'Price', type: 'number' },
  { value: 'supplier_moq', label: 'MOQ', type: 'number' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
]

const OPERATOR_OPTIONS = {
  text: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
    { value: 'is_any_of', label: 'is any of' },
    { value: 'is_none_of', label: 'is none of' },
  ],
  number: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' },
    { value: 'greater_or_equal', label: 'is greater or equal to' },
    { value: 'less_or_equal', label: 'is less or equal to' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  date: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'greater_than', label: 'is after' },
    { value: 'less_than', label: 'is before' },
    { value: 'greater_or_equal', label: 'is on or after' },
    { value: 'less_or_equal', label: 'is on or before' },
  ],
  select: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'is_any_of', label: 'is any of' },
    { value: 'is_none_of', label: 'is none of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
}

export default function ProductFilters({ onFiltersChange, suppliers = [] }) {
  const [conditions, setConditions] = useState([
    { id: 'cond-1', field: '', operator: '', value: '' }
  ])
  const [isOpen, setIsOpen] = useState(false)

  // Update the field options to include dynamic supplier options
  const getFieldOptions = () => {
    const baseOptions = [...FIELD_OPTIONS]
    
    // Add supplier-specific options if suppliers are available
    if (suppliers.length > 0) {
      const supplierOption = {
        value: 'supplier',
        label: 'Supplier',
        type: 'select',
        options: suppliers.map(s => ({ value: s.id, label: s.vendor_name }))
      }
      baseOptions.push(supplierOption)
    }
    
    return baseOptions
  }

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: `cond-${Date.now()}`, field: '', operator: '', value: '' }
    ])
  }

  const removeCondition = (conditionId) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== conditionId))
    } else {
      // Reset the only condition instead of removing it
      setConditions([{ id: 'cond-1', field: '', operator: '', value: '' }])
    }
  }

  const updateCondition = (conditionId, updates) => {
    setConditions(conditions.map(c =>
      c.id === conditionId ? { ...c, ...updates } : c
    ))
  }

  const clearAllFilters = () => {
    setConditions([{ id: 'cond-1', field: '', operator: '', value: '' }])
  }

  const getActiveFilterCount = () => {
    return conditions.filter(condition => 
      condition.field && condition.operator && 
      (condition.operator === 'is_empty' || condition.operator === 'is_not_empty' || condition.value)
    ).length
  }

  // Apply filters whenever they change
  useEffect(() => {
    const validFilters = conditions.filter(c => 
      c.field && c.operator && 
      (c.operator === 'is_empty' || c.operator === 'is_not_empty' || c.value)
    )

    onFiltersChange(validFilters)
  }, [conditions, onFiltersChange])

  const fieldOptions = getFieldOptions()
  const activeCount = getActiveFilterCount()

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {isOpen && (
        <Card className="p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">
                In this view, show products
              </p>
            </div>

            {conditions.map((condition, condIndex) => {
              const selectedField = fieldOptions.find(f => f.value === condition.field)
              const operators = selectedField 
                ? OPERATOR_OPTIONS[selectedField.type] || OPERATOR_OPTIONS.text
                : OPERATOR_OPTIONS.text
              const showValueInput = condition.operator && 
                condition.operator !== 'is_empty' && 
                condition.operator !== 'is_not_empty'
              const isMultiSelect = condition.operator === 'is_any_of' || condition.operator === 'is_none_of'

              return (
                <div key={condition.id} className="flex items-center gap-2">
                  {condIndex > 0 && (
                    <span className="text-sm text-muted-foreground ml-2">and</span>
                  )}
                  {condIndex === 0 && (
                    <span className="text-sm text-muted-foreground">Where</span>
                  )}

                  <Select
                    value={condition.field}
                    onValueChange={(value) => 
                      updateCondition(condition.id, { field: value, value: '' })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions.map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => 
                      updateCondition(condition.id, { operator: value })
                    }
                    disabled={!condition.field}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {showValueInput && (
                    <>
                      {isMultiSelect ? (
                        <div className="w-48">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full justify-between text-left font-normal"
                              >
                                {Array.isArray(condition.value) && condition.value.length > 0 ? (
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    <Badge variant="secondary" className="text-xs">
                                      {condition.value.length} selected
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Select options</span>
                                )}
                                <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                              {selectedField?.type === 'select' && selectedField.options ? (
                                <>
                                  <DropdownMenuLabel className="text-xs text-slate-500 dark:text-slate-400">
                                    Select multiple options
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {selectedField.options.map((opt) => {
                                    const isChecked = Array.isArray(condition.value) && condition.value.includes(opt.value)
                                    return (
                                      <DropdownMenuCheckboxItem
                                        key={opt.value}
                                        checked={isChecked}
                                        onCheckedChange={(checked) => {
                                          const currentValues = Array.isArray(condition.value) 
                                            ? condition.value 
                                            : []
                                          const newValues = checked
                                            ? [...currentValues, opt.value]
                                            : currentValues.filter(v => v !== opt.value)
                                          updateCondition(condition.id, { value: newValues })
                                        }}
                                        className="text-slate-700 dark:text-slate-300"
                                      >
                                        {opt.label}
                                      </DropdownMenuCheckboxItem>
                                    )
                                  })}
                                </>
                              ) : (
                                <div className="p-2 text-sm text-muted-foreground">
                                  Type values separated by commas in the input field
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : selectedField?.type === 'select' ? (
                        <Select
                          value={condition.value}
                          onValueChange={(value) => 
                            updateCondition(condition.id, { value })
                          }
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select value" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectedField.options?.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={selectedField?.type === 'date' ? 'date' : (selectedField?.type || 'text')}
                          value={isMultiSelect ? (Array.isArray(condition.value) ? condition.value.join(', ') : '') : condition.value}
                          onChange={(e) => {
                            if (isMultiSelect) {
                              const values = e.target.value.split(',').map(v => v.trim()).filter(v => v)
                              updateCondition(condition.id, { value: values })
                            } else {
                              updateCondition(condition.id, { value: e.target.value })
                            }
                          }}
                          placeholder={
                            selectedField?.type === 'date' ? "Select a date" :
                            isMultiSelect ? "Enter values separated by commas" : 
                            "Enter a value"
                          }
                          className="w-48"
                          disabled={!condition.operator}
                        />
                      )}
                    </>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeCondition(condition.id)
                    }}
                    disabled={false}
                    title={conditions.length === 1 ? "Clear filter" : "Remove filter"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}

            <Button
              variant="link"
              size="sm"
              onClick={addCondition}
              className="text-blue-600 p-0 h-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add condition
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}