'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase, deleteTrip, updateTrip, removeUserFromTrip } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TiltedCard from '@/components/ui/TiltedCard';

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<{ id: string; name: string } | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  async function handleDeleteTrip(tripId: string) {
    if (!user) return;

    const trip = trips.find(t => t.id === tripId);
    const isOwner = trip?.created_by === user.id;
    
    const confirmMessage = isOwner
      ? 'Are you sure you want to leave this trip? If you are the only member, the trip will be deleted. Otherwise, ownership will be transferred to the oldest member.'
      : 'Are you sure you want to leave this trip?';

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Remove user from trip_members
      // The database trigger will handle ownership transfer or trip deletion
      const { error } = await removeUserFromTrip(tripId, user.id);
      if (error) {
        console.error('Error removing user from trip:', error);
        if (error.code === '42501') {
          alert('You do not have permission to leave this trip.');
        } else {
          alert(`Failed to leave trip: ${error.message}`);
        }
      } else {
        // Reload trips (the trip will no longer appear if user is removed)
        await loadTrips();
        setOpenMenuId(null);
      }
    } catch (err: any) {
      console.error('Error removing user from trip:', err);
      alert(`Failed to leave trip: ${err.message || 'Unknown error'}`);
    }
  }

  async function handleRenameTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrip || !newTripName.trim()) return;

    try {
      const { error } = await updateTrip(editingTrip.id, {
        name: newTripName.trim(),
      } as any);

      if (error) {
        console.error('Error renaming trip:', error);
        alert(`Failed to rename trip: ${error.message}`);
      } else {
        await loadTrips();
        setEditingTrip(null);
        setNewTripName('');
        setOpenMenuId(null);
      }
    } catch (err: any) {
      console.error('Error renaming trip:', err);
      alert(`Failed to rename trip: ${err.message || 'Unknown error'}`);
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenuId && menuRefs.current[openMenuId]) {
        if (!menuRefs.current[openMenuId]?.contains(event.target as Node)) {
          setOpenMenuId(null);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!tripName.trim() || !user) return;

    setCreating(true);
    try {
      // Ensure user profile exists (in case trigger didn't fire)
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();
      
      if (!profile) {
        // Create profile if it doesn't exist
        await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.email || 'User',
          } as any);
      }

      const { data, error } = await supabase
        .from('trips')
        .insert({
          name: tripName.trim(),
          created_by: user.id,
          trip_days: 3,
        } as any)
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
            trip_id: (data as any).id,
            user_id: user.id,
            role: 'owner',
          } as any);

        if (memberError) {
          console.error('Error adding creator to trip_members:', memberError);
          // Don't block - trip was created, just log the error
        }
        
        router.push(`/trip/${(data as any).id}`);
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>My Trips</h1>
            <p className="mt-2" style={{ color: 'var(--muted-foreground)' }}>Manage and view all your trip plans</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-2 rounded-lg transition-colors font-semibold"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            + Create New Trip
          </button>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-lg p-12 text-center" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow)' }}>
            <svg
              className="mx-auto h-12 w-12 mb-4"
              style={{ color: 'var(--muted-foreground)' }}
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
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>No trips yet</h3>
            <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>Get started by creating your first trip</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 rounded-lg transition-colors font-semibold"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Create Your First Trip
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <TiltedCard
                key={trip.id}
                containerHeight="200px"
                rotateAmplitude={6}
                scaleOnHover={1.05}
                showMobileWarning={false}
                showTooltip={false}
              >
                <div className="relative rounded-lg p-6 h-full w-full" style={{ 
                  backgroundColor: 'var(--card)', 
                  boxShadow: 'var(--shadow-lg)',
                  border: '1px solid var(--border)'
                }}>
                  {/* 3-dot menu button - show for all trips */}
                  {user && (
                    <div className="absolute top-2 right-2 z-20" ref={(el) => { menuRefs.current[trip.id] = el; }}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === trip.id ? null : trip.id);
                        }}
                        className="p-1 rounded hover:bg-accent transition-colors"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                      {/* Dropdown menu */}
                      {openMenuId === trip.id && user && (
                        <div className="absolute right-0 mt-1 w-40 rounded-lg shadow-lg z-30" style={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          boxShadow: 'var(--shadow-lg)'
                        }}>
                          {/* Rename option - only for owners */}
                          {trip.created_by === user.id && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingTrip({ id: trip.id, name: trip.name });
                                setNewTripName(trip.name);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors rounded-t-lg"
                              style={{ color: 'var(--foreground)' }}
                            >
                              Rename
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteTrip(trip.id);
                            }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-destructive/10 transition-colors ${trip.created_by === user.id ? 'rounded-b-lg' : 'rounded-lg'}`}
                            style={{ color: 'var(--destructive)' }}
                          >
                            Leave Trip
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <Link
                    href={`/trip/${trip.id}`}
                    className="block h-full w-full"
                  >
                    <h2 className="text-xl font-semibold mb-2 pr-8" style={{ color: 'var(--foreground)' }}>{trip.name}</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                      Created by {trip.profiles?.full_name || trip.profiles?.email || 'Unknown'}
                    </p>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(trip.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                  </Link>
                </div>
              </TiltedCard>
            ))}
          </div>
        )}
      </div>

      {/* Dashboard Art SVG */}
      <div className="w-full flex justify-center mt-16 mb-8">
        <img 
          src="/dashboard_art.svg" 
          alt="Dashboard Art" 
          className="w-full max-w-4xl h-auto"
        />
      </div>

      {/* Rename Trip Modal */}
      {editingTrip && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg p-6 w-96 max-w-[90vw]" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Rename Trip</h3>
              <button
                onClick={() => {
                  setEditingTrip(null);
                  setNewTripName('');
                }}
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
            <form onSubmit={handleRenameTrip} className="space-y-4">
              <div>
                <label htmlFor="rename-trip-name" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Trip Name
                </label>
                <input
                  id="rename-trip-name"
                  type="text"
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="Enter trip name"
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    border: '1px solid var(--input)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                  } as React.CSSProperties}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrip(null);
                    setNewTripName('');
                  }}
                  className="px-4 py-2 rounded-lg transition-colors"
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
                  type="submit"
                  disabled={!newTripName.trim()}
                  className="px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: !newTripName.trim() ? 'var(--muted)' : 'var(--primary)',
                    color: !newTripName.trim() ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
                  }}
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Trip Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="rounded-lg p-6 w-96 max-w-[90vw]" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Create New Trip</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setTripName('');
                }}
                className="transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                disabled={creating}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label htmlFor="trip-name" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Trip Name
                </label>
                <input
                  id="trip-name"
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g., Tokyo 2026"
                  className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    border: '1px solid var(--input)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)'
                  } as React.CSSProperties}
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
                  className="px-4 py-2 rounded-lg transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !tripName.trim()}
                  className="px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: creating || !tripName.trim() ? 'var(--muted)' : 'var(--primary)',
                    color: creating || !tripName.trim() ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
                  }}
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

