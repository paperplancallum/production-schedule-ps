'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'

function VendorSignupForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  })

  const verifyInvitation = useCallback(async () => {
    try {
      const supabase = createClient()
      
      console.log('Verifying invitation token:', token)
      
      // Verify the invitation token
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('invitation_token', token)
        .single()

      console.log('Vendor query result:', { vendorData, vendorError })

      if (vendorError || !vendorData) {
        console.error('Vendor verification failed:', vendorError)
        setError('Invalid or expired invitation token')
        setLoading(false)
        return
      }

      // Check if vendor already accepted
      if (vendorData.vendor_status === 'accepted') {
        setError('This invitation has already been accepted')
        setLoading(false)
        return
      }

      // Get seller info
      const { data: sellerData } = await supabase
        .from('sellers')
        .select('company_name')
        .eq('user_id', vendorData.seller_id)
        .single()

      setVendor({
        ...vendorData,
        seller_name: sellerData?.company_name || 'Your partner'
      })
      
      // Pre-fill name if available
      if (vendorData.contact_name) {
        const names = vendorData.contact_name.split(' ')
        setFormData(prev => ({
          ...prev,
          firstName: names[0] || '',
          lastName: names.slice(1).join(' ') || ''
        }))
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error verifying invitation:', err)
      setError('Failed to verify invitation')
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) {
      verifyInvitation()
    } else {
      setError('No invitation token provided')
      setLoading(false)
    }
  }, [token, verifyInvitation])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate passwords
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    
    setSubmitting(true)
    
    try {
      const supabase = createClient()
      
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: vendor.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            user_type: 'vendor'
          }
        }
      })

      if (authError) throw authError

      const userId = authData.user?.id
      if (!userId) throw new Error('Failed to create user account')

      // Create vendor profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: vendor.email,
          user_type: 'vendor'
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Continue anyway - profile might be created by trigger
      }

      // Update vendor record to link with new user
      const { error: updateError } = await supabase
        .from('vendors')
        .update({
          id: userId,
          vendor_status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('invitation_token', token)

      if (updateError) {
        console.error('Vendor update error:', updateError)
        // Still continue - account was created successfully
      }

      toast.success('Account created successfully!', {
        description: 'Redirecting to login...'
      })
      
      // Sign out and redirect to login
      await supabase.auth.signOut()
      
      setTimeout(() => {
        router.push('/login?message=Account created successfully. Please log in.')
      }, 2000)
      
    } catch (error) {
      console.error('Signup error:', error)
      toast.error('Failed to create account', {
        description: error.message
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Invitation</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="border-red-200">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={() => router.push('/login')}
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to {vendor.seller_name}&apos;s Network</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a {vendor.vendor_type?.replace('_', ' ')}. 
            Create your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                value={vendor.email} 
                disabled 
                className="bg-gray-50"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="At least 6 characters"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
              />
            </div>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong>Company:</strong> {vendor.vendor_name}<br />
                <strong>Location:</strong> {vendor.country || 'Not specified'}
              </AlertDescription>
            </Alert>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function VendorSignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <VendorSignupForm />
    </Suspense>
  )
}