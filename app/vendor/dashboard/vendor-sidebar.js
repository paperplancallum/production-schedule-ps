'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, FileText, Settings } from 'lucide-react'

export default function VendorSidebar({ vendor }) {
  const pathname = usePathname()

  // Define navigation items based on vendor type
  const getNavItems = () => {
    const baseItems = [
      {
        name: 'Dashboard',
        href: '/vendor/dashboard',
        icon: LayoutDashboard
      }
    ]

    if (!vendor) return baseItems

    switch (vendor.vendor_type) {
      case 'supplier':
        return [
          ...baseItems,
          {
            name: 'Products',
            href: '/vendor/dashboard/products',
            icon: Package
          },
          {
            name: 'Purchase Orders',
            href: '/vendor/dashboard/purchase-orders',
            icon: ShoppingCart
          },
          {
            name: 'Settings',
            href: '/vendor/dashboard/settings',
            icon: Settings
          }
        ]
      case 'warehouse':
        return [
          ...baseItems,
          {
            name: 'Inventory',
            href: '/vendor/dashboard/inventory',
            icon: Package
          },
          {
            name: 'Orders',
            href: '/vendor/dashboard/orders',
            icon: ShoppingCart
          },
          {
            name: 'Settings',
            href: '/vendor/dashboard/settings',
            icon: Settings
          }
        ]
      case 'inspection_agent':
        return [
          ...baseItems,
          {
            name: 'Inspections',
            href: '/vendor/dashboard/inspections',
            icon: FileText
          },
          {
            name: 'Reports',
            href: '/vendor/dashboard/reports',
            icon: FileText
          },
          {
            name: 'Settings',
            href: '/vendor/dashboard/settings',
            icon: Settings
          }
        ]
      case 'shipping_agent':
        return [
          ...baseItems,
          {
            name: 'Shipments',
            href: '/vendor/dashboard/shipments',
            icon: Package
          },
          {
            name: 'Tracking',
            href: '/vendor/dashboard/tracking',
            icon: FileText
          },
          {
            name: 'Settings',
            href: '/vendor/dashboard/settings',
            icon: Settings
          }
        ]
      default:
        return baseItems
    }
  }

  const navItems = getNavItems()

  return (
    <aside className="w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {vendor?.vendor_name || 'Vendor Portal'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">
            {vendor?.vendor_type?.replace('_', ' ') || 'Vendor'}
          </p>
        </div>
        
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }
                `}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}