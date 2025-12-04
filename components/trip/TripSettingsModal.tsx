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

    try {
      const calculatedDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const { error: updateError } = await supabase
        .from('trips')
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
    } catch (err: any) {
      console.error('Failed to update trip settings:', err);
      setError(err.message || 'Failed to update trip settings');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Trip Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {tripDays > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Trip Duration:</span> {tripDays} {tripDays === 1 ? 'day' : 'days'}
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !startDate || !endDate || tripDays === 0}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

