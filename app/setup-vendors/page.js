'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, Copy, Loader2 } from 'lucide-react'

export default function SetupVendorsPage() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const sql = `-- First drop the old vendors table if it exists
DROP TABLE IF EXISTS vendors CASCADE;

-- Create a simple vendors table that doesn't require profile connection
CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vendor_name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT,
  address TEXT,
  contact_name TEXT,
  vendor_type TEXT CHECK (vendor_type IN ('warehouse', 'supplier', 'inspection_agent', 'shipping_agent')),
  vendor_status TEXT DEFAULT 'draft' CHECK (vendor_status IN ('draft', 'invited', 'accepted', 'archived')),
  vendor_code TEXT UNIQUE DEFAULT 'V' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vendors_seller_id ON vendors(seller_id);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_status ON vendors(vendor_status);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Sellers can view their vendors" ON vendors
  FOR SELECT
  USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert vendors" ON vendors
  FOR INSERT
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update their vendors" ON vendors
  FOR UPDATE
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can delete their vendors" ON vendors
  FOR DELETE
  USING (seller_id = auth.uid());`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql)
    setStatus('SQL copied to clipboard!')
    setTimeout(() => setStatus(''), 3000)
  }

  const checkSetup = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/setup-vendors-simple')
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Setup Vendors Table</CardTitle>
          <CardDescription>
            This page helps you consolidate and set up the vendors table in your Supabase database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Option 1: Automatic Setup</h3>
            <p className="text-sm text-gray-600">Click the button below to try automatic setup</p>
            <Button 
              onClick={checkSetup} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                'Check/Create Vendors Table'
              )}
            </Button>
          </div>

          {result && (
            <Alert className={result.success ? 'border-green-200' : 'border-red-200'}>
              <div className="flex items-start space-x-2">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                )}
                <AlertDescription>
                  <div className="font-medium">{result.message}</div>
                  {result.error && (
                    <div className="text-sm text-gray-600 mt-1">Error: {result.error}</div>
                  )}
                </AlertDescription>
              </div>
            </Alert>
          )}

          <div className="border-t pt-4 space-y-2">
            <h3 className="text-lg font-semibold">Option 2: Manual Setup</h3>
            <p className="text-sm text-gray-600">
              Copy the SQL below and run it in your Supabase SQL Editor
            </p>
            
            <ol className="list-decimal list-inside text-sm space-y-1 text-gray-600">
              <li>Go to your Supabase Dashboard</li>
              <li>Navigate to SQL Editor</li>
              <li>Paste the SQL below and click "Run"</li>
            </ol>

            <div className="relative">
              <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-xs">
                {sql}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy SQL
              </Button>
            </div>
            
            {status && (
              <p className="text-sm text-green-600 font-medium">{status}</p>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-2">After Setup</h3>
            <p className="text-sm text-gray-600">
              Once you've created the table, go back to the{' '}
              <a href="/seller/vendors" className="text-blue-600 hover:underline">
                Vendors page
              </a>{' '}
              and try adding a vendor again.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}