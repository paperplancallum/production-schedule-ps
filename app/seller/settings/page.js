'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Save, User, Building } from 'lucide-react'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userInfo, setUserInfo] = useState({
    email: '',
    full_name: ''
  })
  const [businessInfo, setBusinessInfo] = useState({
    company_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip_code: '',
    country: '',
    business_email: '',
    business_phone: '',
    tax_id: '',
    website: ''
  })
  
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      
      // Get user data
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      
      if (user) {
        // Set email from auth
        setUserInfo(prev => ({ ...prev, email: user.email || '' }))
        
        // Get seller profile data
        const { data: sellerData, error: sellerError } = await supabase
          .from('sellers')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (sellerData) {
          // Set user info
          setUserInfo(prev => ({
            ...prev,
            full_name: sellerData.full_name || ''
          }))
          
          // Set business info
          setBusinessInfo({
            company_name: sellerData.company_name || '',
            address_line1: sellerData.address_line1 || '',
            address_line2: sellerData.address_line2 || '',
            city: sellerData.city || '',
            state: sellerData.state || '',
            zip_code: sellerData.zip_code || '',
            country: sellerData.country || '',
            business_email: sellerData.business_email || '',
            business_phone: sellerData.business_phone || '',
            tax_id: sellerData.tax_id || '',
            website: sellerData.website || ''
          })
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveUserInfo = async () => {
    try {
      setSaving(true)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      
      if (user) {
        const { error } = await supabase
          .from('sellers')
          .update({
            full_name: userInfo.full_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
        
        if (error) throw error
        
        toast.success('User information saved successfully')
      }
    } catch (error) {
      console.error('Error saving user info:', error)
      toast.error('Failed to save user information')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveBusinessInfo = async () => {
    try {
      setSaving(true)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      
      if (user) {
        const { error } = await supabase
          .from('sellers')
          .update({
            ...businessInfo,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
        
        if (error) throw error
        
        toast.success('Business information saved successfully')
      }
    } catch (error) {
      console.error('Error saving business info:', error)
      toast.error('Failed to save business information')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Settings
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Manage your account settings
          </p>
        </div>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Settings
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          Manage your account settings
        </p>
      </div>

      <Tabs defaultValue="user" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger 
            value="user"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100"
          >
            <User className="mr-2 h-4 w-4" />
            User Information
          </TabsTrigger>
          <TabsTrigger 
            value="business"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm data-[state=inactive]:text-slate-600 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-slate-100"
          >
            <Building className="mr-2 h-4 w-4" />
            Business Information
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="user" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>
                Update your personal account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={userInfo.email}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">Email cannot be changed here</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={userInfo.full_name}
                  onChange={(e) => setUserInfo({ ...userInfo, full_name: e.target.value })}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div className="pt-4">
                <Button onClick={handleSaveUserInfo} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="business" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Manage your business details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={businessInfo.company_name}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, company_name: e.target.value })}
                    placeholder="Enter company name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID / VAT Number</Label>
                  <Input
                    id="tax_id"
                    value={businessInfo.tax_id}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, tax_id: e.target.value })}
                    placeholder="Enter tax ID"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address_line1">Address Line 1</Label>
                <Input
                  id="address_line1"
                  value={businessInfo.address_line1}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, address_line1: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address_line2">Address Line 2</Label>
                <Input
                  id="address_line2"
                  value={businessInfo.address_line2}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, address_line2: e.target.value })}
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={businessInfo.city}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={businessInfo.state}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, state: e.target.value })}
                    placeholder="State"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="zip_code">ZIP / Postal Code</Label>
                  <Input
                    id="zip_code"
                    value={businessInfo.zip_code}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, zip_code: e.target.value })}
                    placeholder="ZIP code"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={businessInfo.country}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, country: e.target.value })}
                  placeholder="Country"
                />
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="business_email">Business Email</Label>
                  <Input
                    id="business_email"
                    type="email"
                    value={businessInfo.business_email}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, business_email: e.target.value })}
                    placeholder="business@example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="business_phone">Business Phone</Label>
                  <Input
                    id="business_phone"
                    type="tel"
                    value={businessInfo.business_phone}
                    onChange={(e) => setBusinessInfo({ ...businessInfo, business_phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={businessInfo.website}
                  onChange={(e) => setBusinessInfo({ ...businessInfo, website: e.target.value })}
                  placeholder="https://www.example.com"
                />
              </div>
              
              <div className="pt-4">
                <Button onClick={handleSaveBusinessInfo} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}