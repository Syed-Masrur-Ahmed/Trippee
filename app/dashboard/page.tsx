'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Trip {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  profiles?: {
    id: string;
    email: string;
    full_name: string;
  };
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tripName, setTripName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (user) {
      loadTrips();
    }
  }, [user, authLoading, router]);

  async function loadTrips() {
    if (!user) return;

    try {
      // First, get trips the user created
      const { data: ownedTrips, error: ownedError } = await supabase
        .from('trips')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (ownedError) {
        console.error('Error loading owned trips:', ownedError);
      }

      // Then, get trips where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('trip_members')
        .select('trip_id, trips(*)')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('Error loading member trips:', memberError);
      }

      // Combine trips
      const allTrips: Trip[] = [...(ownedTrips || [])];
      
      // Add member trips (avoid duplicates)
      if (memberData) {
        memberData.forEach((member: any) => {
          if (member.trips && !allTrips.find((t) => t.id === member.trip_id)) {
            allTrips.push(member.trips as Trip);
          }
        });
      }

      // Sort by created_at
      allTrips.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTrips(allTrips);
    } catch (err) {
      console.error('Error loading trips:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!tripName.trim() || !user) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('trips')
        .insert({
          name: tripName.trim(),
          created_by: user.id,
          trip_days: 3,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating trip:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        alert(`Failed to create trip: ${error.message || 'Unknown error'}. Please check the console for details.`);
      } else if (data) {
        // Add the creator as a member of the trip
        const { error: memberError } = await supabase
          .from('trip_members')
          .insert({
            trip_id: data.id,
            user_id: user.id,
            role: 'owner',
          } as any);

        if (memberError) {
          console.error('Error adding creator to trip_members:', memberError);
          // Don't block - trip was created, just log the error
        }
        
        router.push(`/trip/${data.id}`);
      }
    } catch (err: any) {
      console.error('Error creating trip:', err);
      alert(`Failed to create trip: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Trips</h1>
            <p className="text-gray-600 mt-2">Manage and view all your trip plans</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
          >
            + Create New Trip
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No trips yet</h3>
            <p className="text-gray-700 mb-6">Get started by creating your first trip</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
            >
              Create Your First Trip
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trip/${trip.id}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 block"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-2">{trip.name}</h2>
                <p className="text-sm text-gray-700 mb-4">
                  Created by {trip.profiles?.full_name || trip.profiles?.email || 'Unknown'}
                </p>
                <div className="text-xs text-gray-600">
                  {new Date(trip.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Trip Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create New Trip</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setTripName('');
                }}
                className="text-gray-700 hover:text-gray-900"
                disabled={creating}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label htmlFor="trip-name" className="block text-sm font-medium text-gray-700 mb-2">
                  Trip Name
                </label>
                <input
                  id="trip-name"
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g., Tokyo 2026"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-600 text-gray-900"
                  required
                  disabled={creating}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setTripName('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-900"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !tripName.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

