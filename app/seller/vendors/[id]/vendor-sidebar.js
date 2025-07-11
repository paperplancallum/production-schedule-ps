'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, ShoppingCart, Settings, FileText, Users } from 'lucide-react'

export default function VendorSidebar({ vendor }) {
  const pathname = usePathname()
  const vendorId = vendor.id

  // Define navigation items based on vendor type
  const getNavItems = () => {
    const baseItems = [
      {
        name: 'Overview',
        href: `/seller/vendors/${vendorId}`,
        icon: FileText
      }
    ]

    switch (vendor.vendor_type) {
      case 'supplier':
        return [
          ...baseItems,
          {
            name: 'Products',
            href: `/seller/vendors/${vendorId}/products`,
            icon: Package
          },
          {
            name: 'Purchase Orders',
            href: `/seller/vendors/${vendorId}/purchase-orders`,
            icon: ShoppingCart
          },
          {
            name: 'Settings',
            href: `/seller/vendors/${vendorId}/settings`,
            icon: Settings
          }
        ]
      case 'subcontractor':
        return [
          ...baseItems,
          {
            name: 'Work Orders',
            href: `/seller/vendors/${vendorId}/work-orders`,
            icon: FileText
          },
          {
            name: 'Team',
            href: `/seller/vendors/${vendorId}/team`,
            icon: Users
          },
          {
            name: 'Settings',
            href: `/seller/vendors/${vendorId}/settings`,
            icon: Settings
          }
        ]
      case 'fulfillment':
        return [
          ...baseItems,
          {
            name: 'Orders',
            href: `/seller/vendors/${vendorId}/orders`,
            icon: ShoppingCart
          },
          {
            name: 'Inventory',
            href: `/seller/vendors/${vendorId}/inventory`,
            icon: Package
          },
          {
            name: 'Settings',
            href: `/seller/vendors/${vendorId}/settings`,
            icon: Settings
          }
        ]
      default:
        return baseItems
    }
  }

  const navItems = getNavItems()

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{vendor.vendor_name}</h2>
          <p className="text-sm text-gray-500 capitalize">{vendor.vendor_type.replace('_', ' ')}</p>
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
                  flex items-center px-3 py-2 text-sm font-medium rounded-md
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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