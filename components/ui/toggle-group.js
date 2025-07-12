"use client"

import * as React from "react"
import * as TogglePrimitive from "@radix-ui/react-toggle-group"
import { cn } from "@/lib/utils"

const ToggleGroup = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn("inline-flex rounded-md shadow-sm", className)}
    {...props}
  />
))
ToggleGroup.displayName = TogglePrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef(({ className, variant = "default", ...props }, ref) => (
  <TogglePrimitive.Item
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center text-sm font-medium transition-all",
      "first:rounded-l-md last:rounded-r-md",
      "border-y border-r first:border-l border-slate-200 dark:border-slate-800",
      "px-3 py-1.5",
      "hover:bg-slate-100 dark:hover:bg-slate-800",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "data-[state=off]:bg-white dark:data-[state=off]:bg-slate-950",
      "data-[state=off]:text-slate-600 dark:data-[state=off]:text-slate-400",
      "data-[state=on]:bg-slate-900 dark:data-[state=on]:bg-slate-100",
      "data-[state=on]:text-white dark:data-[state=on]:text-slate-900",
      "data-[state=on]:border-slate-900 dark:data-[state=on]:border-slate-100",
      className
    )}
    variant={variant}
    {...props}
  />
))
ToggleGroupItem.displayName = TogglePrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }