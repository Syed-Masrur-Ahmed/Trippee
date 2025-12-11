'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase, updateTrip, removeUserFromTrip } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TiltedCard from '@/components/ui/TiltedCard';
import { type PendingInvite } from '@/app/actions/invites';

interface ProfileData {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface Trip {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  original_created_by?: string | null;
  profiles?: ProfileData;
}

interface TripMemberWithTrip {
  trip_id: string;
  trips: Trip | null;
}

type TabType = 'trips' | 'invites';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('trips');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [tripName, setTripName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<{ id: string; name: string } | null>(null);
  const [newTripName, setNewTripName] = useState('');
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const menuRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (user) {
      loadTrips();
      loadInvites();
    }
  }, [user, authLoading, router]);

  async function loadInvites() {
    if (!user) return;
    setInvitesLoading(true);
    try {
      // Get user's profile to match email
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      const userEmail = (profileData as { email: string } | null)?.email;
      if (!userEmail) {
        setPendingInvites([]);
        setInvitesLoading(false);
        return;
      }

      // Fetch pending invitations for this email using raw query
      const { data: invitations, error } = await (supabase
        .from('trip_invitations') as any)
        .select('*')
        .eq('email', userEmail)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching invitations:', error);
        setPendingInvites([]);
        setInvitesLoading(false);
        return;
      }

      const invitationsData = invitations as Array<{
        id: string;
        trip_id: string;
        email: string;
        status: string;
        created_at: string;
        expires_at: string;
        invited_by: string;
      }> | null;

      if (!invitationsData || invitationsData.length === 0) {
        setPendingInvites([]);
        setInvitesLoading(false);
        return;
      }

      // Fetch trip details separately
      const tripIds = [...new Set(invitationsData.map((inv) => inv.trip_id))];
      const { data: trips } = await supabase
        .from('trips')
        .select('id, name, start_date, end_date, created_by')
        .in('id', tripIds);

      const tripMap = new Map((trips || []).map((t: any) => [t.id, t]));

      // Fetch inviter profiles
      const inviterIds = [...new Set(invitationsData.map((inv) => inv.invited_by))];
      const { data: inviters } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', inviterIds);

      const inviterMap = new Map((inviters || []).map((p: any) => [p.id, p]));

      // Transform the data
      const formattedInvites: PendingInvite[] = invitationsData.map((inv) => ({
        id: inv.id,
        trip_id: inv.trip_id,
        email: inv.email,
        status: inv.status,
        created_at: inv.created_at,
        expires_at: inv.expires_at,
        invited_by: inv.invited_by,
        trip: tripMap.get(inv.trip_id) || { id: inv.trip_id, name: 'Unknown Trip', start_date: null, end_date: null, created_by: '' },
        inviter: inviterMap.get(inv.invited_by) || null,
      }));

      setPendingInvites(formattedInvites);
    } catch (err) {
      console.error('Error loading invites:', err);
      setPendingInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }

  async function loadTrips() {
    if (!user) return;

    try {
      // First, get trips the user created
      const { data: ownedTrips } = await supabase
        .from('trips')
        .select('*, original_created_by')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      // Then, get trips where user is a member
      const { data: memberData } = await supabase
        .from('trip_members')
        .select('trip_id, trips(*, original_created_by)')
        .eq('user_id', user.id);

      // Combine trips
      const allTrips: Trip[] = [...(ownedTrips || [])];
      
      // Add member trips (avoid duplicates)
      if (memberData) {
        (memberData as TripMemberWithTrip[]).forEach((member) => {
          if (member.trips && !allTrips.find((t) => t.id === member.trip_id)) {
            allTrips.push(member.trips);
          }
        });
      }

      // Get unique creator IDs (both original and current)
      const creatorIds = new Set<string>();
      allTrips.forEach(trip => {
        // Add original_created_by if it exists, otherwise use created_by as the original
        const originalCreatorId = trip.original_created_by ?? trip.created_by;
        if (originalCreatorId) creatorIds.add(originalCreatorId);
        // Also add current created_by (for host display)
        if (trip.created_by) creatorIds.add(trip.created_by);
      });
      
      // Fetch profiles for all creators
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(creatorIds));

      // Create a map of creator ID to profile
      const profilesMap = new Map<string, ProfileData>(
        (profilesData || []).map((profile: ProfileData) => [profile.id, profile])
      );

      // Attach profiles to trips
      // Use original_created_by for the creator profile, created_by for current owner
      const tripsWithProfiles = allTrips.map(trip => {
        const originalCreatorId = trip.original_created_by ?? trip.created_by;
        return {
          ...trip,
          profiles: profilesMap.get(originalCreatorId)
        };
      });

      // Sort by created_at
      tripsWithProfiles.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTrips(tripsWithProfiles);
    } catch {
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
        if (error.code === '42501') {
          alert('You do not have permission to leave this trip.');
        } else {
          alert(`Failed to leave trip: ${error.message}`);
        }
      } else {
        // Reload trips (the trip will no longer appear if user is removed)
        await loadTrips();
        await loadInvites(); // Refresh invites in case accepting one
        setOpenMenuId(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to leave trip: ${message}`);
    }
  }

  async function handleRenameTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTrip || !newTripName.trim()) return;

    try {
      const { error } = await updateTrip(editingTrip.id, {
        name: newTripName.trim(),
      });

      if (error) {
        alert(`Failed to rename trip: ${error.message}`);
      } else {
        await loadTrips();
        await loadInvites(); // Refresh invites in case accepting one
        setEditingTrip(null);
        setNewTripName('');
        setOpenMenuId(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to rename trip: ${message}`);
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
        await (supabase.from('profiles') as unknown as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert({
          id: user.id,
          email: user.email || '',
          full_name: (user.user_metadata?.full_name as string) || user.email || 'User',
        });
      }

      const { data, error } = await (supabase.from('trips') as unknown as { 
        insert: (data: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: { id: string } | null; error: { message: string } | null }> } }
      }).insert({
        name: tripName.trim(),
        created_by: user.id,
        trip_days: 3,
      }).select().single();

      if (error) {
        alert(`Failed to create trip: ${error.message || 'Unknown error'}`);
      } else if (data) {
        // Add the creator as a member of the trip
        await (supabase.from('trip_members') as unknown as { insert: (data: Record<string, unknown>) => Promise<unknown> }).insert({
          trip_id: data.id,
          user_id: user.id,
          role: 'owner',
        });

        router.push(`/trip/${data.id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to create trip: ${message}. Please try again.`);
    } finally {
      setCreating(false);
    }
  }

  async function handleAcceptInvite(inviteId: string) {
    if (!user) {
      alert('You must be signed in to accept invitations');
      return;
    }
    
    setProcessingInvite(inviteId);
    // Optimistic update
    setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    
    try {
      // Get the invitation details
      const { data: invitation, error: inviteError } = await (supabase
        .from('trip_invitations') as any)
        .select('trip_id, email, expires_at')
        .eq('id', inviteId)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invitation) {
        await loadInvites();
        alert('Invitation not found or already processed');
        return;
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('trip_members')
        .select('id')
        .eq('trip_id', invitation.trip_id)
        .eq('user_id', user.id)
        .single();

      if (!existingMember) {
        // Add user to trip_members
        const { error: memberError } = await (supabase
          .from('trip_members') as any)
          .insert({
            trip_id: invitation.trip_id,
            user_id: user.id,
            role: 'member',
          });

        if (memberError) {
          await loadInvites();
          alert(`Failed to join trip: ${memberError.message}`);
          return;
        }
      }

      // Update invitation status
      await (supabase
        .from('trip_invitations') as any)
        .update({ status: 'accepted' })
        .eq('id', inviteId);

      // Reload trips to show the newly accepted trip
      await loadTrips();
      await loadInvites();
    } catch (error) {
      await loadInvites();
      const message = error instanceof Error ? error.message : 'Failed to accept invitation';
      alert(message);
    } finally {
      setProcessingInvite(null);
    }
  }

  async function handleDeclineInvite(inviteId: string) {
    if (!user) {
      alert('You must be signed in to decline invitations');
      return;
    }
    
    setProcessingInvite(inviteId);
    // Optimistic update
    setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    
    try {
      // Update invitation status to declined
      const { error } = await (supabase
        .from('trip_invitations') as any)
        .update({ status: 'declined' })
        .eq('id', inviteId);

      if (error) {
        await loadInvites();
        alert(`Failed to decline invitation: ${error.message}`);
      }
    } catch (error) {
      await loadInvites();
      const message = error instanceof Error ? error.message : 'Failed to decline invitation';
      alert(message);
    } finally {
      setProcessingInvite(null);
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
            <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>Dashboard</h1>
            <p className="mt-2" style={{ color: 'var(--muted-foreground)' }}>Manage and view all your trip plans</p>
          </div>
          {activeTab === 'trips' && (
            <button
              onClick={() => setShowModal(true)}
              className="px-6 py-2 rounded-lg transition-colors font-semibold"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              + Create New Trip
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setActiveTab('trips')}
            className="px-4 py-2 font-medium transition-colors relative"
            style={{
              color: activeTab === 'trips' ? 'var(--foreground)' : 'var(--muted-foreground)',
              borderBottom: activeTab === 'trips' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            My Trips
          </button>
          <button
            onClick={() => setActiveTab('invites')}
            className="px-4 py-2 font-medium transition-colors relative"
            style={{
              color: activeTab === 'invites' ? 'var(--foreground)' : 'var(--muted-foreground)',
              borderBottom: activeTab === 'invites' ? '2px solid var(--primary)' : '2px solid transparent',
            }}
          >
            Invites
            {pendingInvites.length > 0 && (
              <span
                className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--destructive)',
                  color: 'var(--destructive-foreground)',
                }}
              >
                {pendingInvites.length}
              </span>
            )}
          </button>
        </div>

        {/* Trips Tab */}
        {activeTab === 'trips' && (
          <>
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
                        <div className="mb-4 space-y-1">
                          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            {(() => {
                              const originalCreatorId = (trip as any).original_created_by ?? trip.created_by;
                              if (originalCreatorId === user?.id) {
                                return 'Created by you';
                              }
                              return `Created by ${trip.profiles?.full_name || trip.profiles?.email || 'Unknown'}`;
                            })()}
                          </p>
                          {trip.created_by === user?.id && (
                            <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                              Host: you
                            </p>
                          )}
                        </div>
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
          </>
        )}

        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <>
            {invitesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-lg" style={{ color: 'var(--muted-foreground)' }}>Loading invites...</div>
              </div>
            ) : pendingInvites.length === 0 ? (
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
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>No pending invitations</h3>
                <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>You don&apos;t have any pending trip invitations</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingInvites.map((invite) => (
                  <TiltedCard
                    key={invite.id}
                    containerHeight="240px"
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
                      <div className="mb-4">
                        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                          {invite.trip.name}
                        </h2>
                        {invite.inviter && (
                          <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
                            Invited by {invite.inviter.full_name || invite.inviter.email || 'Unknown'}
                          </p>
                        )}
                        {invite.trip.start_date && invite.trip.end_date && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {new Date(invite.trip.start_date).toLocaleDateString()} - {new Date(invite.trip.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleAcceptInvite(invite.id)}
                          disabled={processingInvite === invite.id}
                          className="flex-1 px-4 py-2 rounded-lg transition-colors font-semibold disabled:cursor-not-allowed"
                          style={{
                            backgroundColor: processingInvite === invite.id ? 'var(--muted)' : 'var(--primary)',
                            color: processingInvite === invite.id ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
                          }}
                        >
                          {processingInvite === invite.id ? 'Processing...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleDeclineInvite(invite.id)}
                          disabled={processingInvite === invite.id}
                          className="flex-1 px-4 py-2 rounded-lg transition-colors font-semibold disabled:cursor-not-allowed"
                          style={{
                            border: '1px solid var(--border)',
                            color: processingInvite === invite.id ? 'var(--muted-foreground)' : 'var(--foreground)',
                            backgroundColor: processingInvite === invite.id ? 'var(--muted)' : 'transparent'
                          }}
                          onMouseEnter={(e) => {
                            if (processingInvite !== invite.id) {
                              e.currentTarget.style.backgroundColor = 'var(--accent)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (processingInvite !== invite.id) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          {processingInvite === invite.id ? 'Processing...' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  </TiltedCard>
                ))}
              </div>
            )}
          </>
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

