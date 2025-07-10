import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function VendorDashboard() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Check if user is a vendor
  if (profile?.user_type !== 'vendor') {
    redirect('/seller/dashboard')
  }

  // Get vendor details including seller info
  const { data: vendorData, error: vendorError } = await supabase
    .from('vendors')
    .select(`
      *,
      seller:sellers!vendors_seller_id_fkey (
        id,
        profile:profiles!sellers_id_fkey (
          full_name,
          company_name
        )
      )
    `)
    .eq('user_id', user.id)
    .single()

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <nav className="bg-white dark:bg-slate-950 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Vendor Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {profile?.full_name || user.email}
              </span>
              <form action={signOut}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Welcome back, {profile?.full_name || 'Vendor'}!
            </h2>
            {profile?.company_name && (
              <p className="text-slate-600 dark:text-slate-400">
                {profile.company_name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Your Seller</CardTitle>
                <CardDescription>Connected seller account</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-semibold">
                  {vendorData?.seller?.profile?.company_name || 'Unknown Company'}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {vendorData?.seller?.profile?.full_name || 'Unknown Seller'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vendor Code</CardTitle>
                <CardDescription>Your unique identifier</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono">
                  {vendorData?.vendor_code || 'Not assigned'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Account status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium">Active</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Production Schedule</CardTitle>
                <CardDescription>
                  Your assigned production tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400">
                  No production tasks assigned yet. Your seller will assign tasks to you.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Your recent actions and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 dark:text-slate-400">
                  No recent activity to display.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}