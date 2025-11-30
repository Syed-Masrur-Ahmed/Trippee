'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function TestPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [testTripId, setTestTripId] = useState<string | null>(null);

  useEffect(() => {
    testConnection();
  }, []);

  async function testConnection() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      setStatus('error');
      setMessage('Missing credentials in .env.local');
      return;
    }

    try {
      // Test connection by querying the trips table
      const { data, error } = await supabase.from('trips').select('*').limit(1);

      if (error && !error.message.includes('no rows')) {
        setStatus('error');
        setMessage(`Connection failed: ${error.message}`);
      } else {
        setStatus('success');
        setMessage(`Connected to: ${supabaseUrl}. Database tables ready!`);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  async function testCreateTrip() {
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert({ name: 'Test Trip', trip_days: 3 })
        .select()
        .single();

      if (error) throw error;

      setTestTripId(data.id);
      setMessage(`Trip created successfully! ID: ${data.id}`);
    } catch (err: any) {
      setMessage(`Failed to create trip: ${err.message}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="rounded-lg bg-white p-8 shadow-lg max-w-md w-full">
        <h1 className="mb-4 text-2xl font-bold">Supabase Connection Test</h1>
        
        {status === 'loading' && (
          <div className="text-gray-600">Testing connection...</div>
        )}
        
        {status === 'success' && (
          <div>
            <div className="mb-2 text-green-600 text-xl font-bold">SUCCESS</div>
            <div className="text-green-600 font-semibold">Connected successfully!</div>
            <div className="mt-2 text-sm text-gray-600">{message}</div>
            
            <div className="mt-6 pt-6 border-t">
              <h2 className="text-lg font-semibold mb-3">Test Database Operations</h2>
              <button
                onClick={testCreateTrip}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create Test Trip
              </button>
              {testTripId && (
                <div className="mt-3 p-3 bg-green-50 rounded text-sm">
                  Trip created with ID: {testTripId}
                </div>
              )}
            </div>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <div className="mb-2 text-red-600 text-xl font-bold">ERROR</div>
            <div className="text-red-600 font-semibold">Connection failed</div>
            <div className="mt-2 text-sm text-gray-600">{message}</div>
            <div className="mt-4 text-xs text-gray-500">
              <p>Make sure you:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Created .env.local file</li>
                <li>Added NEXT_PUBLIC_SUPABASE_URL</li>
                <li>Added NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                <li>Restarted the dev server</li>
                <li>Ran the SQL to create tables</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

