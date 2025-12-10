'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

interface TripSettingsModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
  initialStartDate?: string | null;
  initialEndDate?: string | null;
  onUpdate?: () => void;
}

export default function TripSettingsModal({
  tripId,
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  onUpdate,
}: TripSettingsModalProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [tripDays, setTripDays] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Format dates for input (YYYY-MM-DD)
      if (initialStartDate) {
        const start = new Date(initialStartDate);
        setStartDate(start.toISOString().split('T')[0]);
      } else {
        setStartDate('');
      }

      if (initialEndDate) {
        const end = new Date(initialEndDate);
        setEndDate(end.toISOString().split('T')[0]);
      } else {
        setEndDate('');
      }

      // Calculate trip days
      if (initialStartDate && initialEndDate) {
        const start = new Date(initialStartDate);
        const end = new Date(initialEndDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setTripDays(days);
      }
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  useEffect(() => {
    // Recalculate trip days when dates change
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (end >= start) {
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        setTripDays(days);
        setError(null);
      } else {
        setError('End date must be after start date');
        setTripDays(0);
      }
    } else {
      setTripDays(0);
    }
  }, [startDate, endDate]);

  async function handleSave() {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setError('End date must be after start date');
      return;
    }

    setLoading(true);
    setError(null);

    // Calculate days before try block so it's available in catch
    const calculatedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    try {
      const { error: updateError } = await (supabase
        .from('trips') as any)
        .update({
          start_date: startDate,
          end_date: endDate,
          trip_days: calculatedDays,
        })
        .eq('id', tripId);

      if (updateError) {
        throw updateError;
      }

      onUpdate?.();
      onClose();
    } catch (err: unknown) {
      // Parse database errors and show user-friendly messages
      let errorMessage = 'Failed to update trip settings';
      
      // Handle Supabase error object structure - check multiple possible locations
      const errorObj = (err || {}) as Record<string, unknown>;
      let errorMessageText = '';
      
      // Try different ways to extract the error message
      if (typeof err === 'string') {
        errorMessageText = err;
      } else if (err instanceof Error) {
        errorMessageText = err.message;
      } else if (typeof errorObj.message === 'string') {
        errorMessageText = errorObj.message;
      } else if (typeof errorObj.details === 'string') {
        errorMessageText = errorObj.details;
      } else if (typeof errorObj.hint === 'string') {
        errorMessageText = errorObj.hint;
      } else if (typeof errorObj.code === 'string') {
        // Supabase errors sometimes have codes
        errorMessageText = `Database error (${errorObj.code})`;
      } else {
        // Try to stringify to see what we have
        try {
          const errorStr = JSON.stringify(errorObj);
          if (errorStr && errorStr !== '{}') {
            errorMessageText = errorStr;
          }
        } catch {
          // Ignore JSON stringify errors
        }
      }
      
      if (errorMessageText) {
        const message = errorMessageText.toLowerCase();
        
        if (message.includes('trip_days') || message.includes('trip_days_check')) {
          errorMessage = `Trip duration must be between 1 and 14 days. Your trip is ${calculatedDays} days.`;
        } else if (message.includes('dates_check') || message.includes('end_date')) {
          errorMessage = 'End date must be after or equal to start date.';
        } else if (message.includes('check constraint')) {
          // Generic check constraint error - try to extract useful info
          errorMessage = `Invalid trip settings. Please check your dates and try again. (Trip duration: ${calculatedDays} days)`;
        } else {
          errorMessage = errorMessageText;
        }
      } else {
        // If no message, provide a generic error with calculated days
        errorMessage = `Failed to update trip settings. Please check your dates. (Trip duration: ${calculatedDays} days)`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-lg w-full max-w-md p-6" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Trip Settings</h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-all"
              style={{
                border: '1px solid var(--input)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                '--tw-ring-color': 'var(--ring)'
              } as React.CSSProperties}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-all"
              style={{
                border: '1px solid var(--input)',
                backgroundColor: 'var(--background)',
                color: 'var(--foreground)',
                '--tw-ring-color': 'var(--ring)'
              } as React.CSSProperties}
            />
          </div>

          {tripDays > 0 && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                <span className="font-medium">Trip Duration:</span> {tripDays} {tripDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--destructive)' }}>
              <p className="text-sm" style={{ color: 'var(--destructive)' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg transition-colors"
              style={{
                border: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !startDate || !endDate || tripDays === 0}
              className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
              style={{
                backgroundColor: loading || !startDate || !endDate || tripDays === 0 ? 'var(--muted)' : 'var(--primary)',
                color: loading || !startDate || !endDate || tripDays === 0 ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

