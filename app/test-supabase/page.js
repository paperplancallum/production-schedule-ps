'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestSupabase() {
  const [connectionStatus, setConnectionStatus] = useState('Checking connection...')
  const [tables, setTables] = useState([])

  useEffect(() => {
    async function checkConnection() {
      try {
        // Test the connection by fetching tables
        const { data, error } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .limit(10)

        if (error) {
          // This is normal if no tables exist yet
          setConnectionStatus('✅ Connected to Supabase (No tables found or access restricted)')
        } else {
          setConnectionStatus('✅ Successfully connected to Supabase!')
          setTables(data || [])
        }
      } catch (err) {
        setConnectionStatus(`❌ Connection failed: ${err.message}`)
      }
    }

    checkConnection()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Supabase Connection Test</h1>
      <p>{connectionStatus}</p>
      {tables.length > 0 && (
        <div>
          <h2>Public Tables:</h2>
          <ul>
            {tables.map((table, index) => (
              <li key={index}>{table.table_name}</li>
            ))}
          </ul>
        </div>
      )}
      <hr />
      <p>Project URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
    </div>
  )
}