import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  Users,
  LogOut,
  ClipboardCheck
} from 'lucide-react'

export default async function SellerLayout({ children }) {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Check if user is a seller
  if (profile?.user_type !== 'seller') {
    redirect('/vendor/dashboard')
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const menuItems = [
    {
      name: 'Dashboard',
      href: '/seller/dashboard',
      icon: LayoutDashboard
    },
    {
      name: 'Products',
      href: '/seller/products',
      icon: Package
    },
    {
      name: 'Purchase Orders',
      href: '/seller/purchase-orders',
      icon: ShoppingCart
    },
    {
      name: 'Vendors',
      href: '/seller/vendors',
      icon: Users
    },
    {
      name: 'Inspections',
      href: '/seller/inspections',
      icon: ClipboardCheck
    },
    {
      name: 'Settings',
      href: '/seller/settings',
      icon: Settings
    }
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Production Schedule</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">
                {profile?.full_name || user.email}
              </span>
              <form action={signOut}>
                <Button variant="ghost" size="sm" type="submit">
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200">
          <div className="flex flex-col h-[calc(100vh-4rem)]">
            <nav className="flex-1 px-4 py-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
            
            {/* Company info at bottom of sidebar */}
            {profile?.company_name && (
              <div className="p-4 border-t border-slate-200">
                <p className="text-xs text-slate-500">Company</p>
                <p className="text-sm font-medium text-slate-900">
                  {profile.company_name}
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}