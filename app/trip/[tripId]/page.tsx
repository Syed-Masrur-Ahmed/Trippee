'use client';

import { useEffect, useState } from 'react';
import { getPlaces, createPlace, updatePlace, deletePlace, getTrip } from '@/lib/supabase/client';
import { supabase } from '@/lib/supabase/client';
import MapView from '@/components/map/MapView';
import PlaceModal from '@/components/map/PlaceModal';
import ItineraryPanel from '@/components/itinerary/ItineraryPanel';
import { subscribeToTrip, broadcastEvent, RealtimeEvent } from '@/lib/supabase/realtime';
import { getDistance } from '@/lib/utils/geo';
import { useAuth } from '@/lib/hooks/useAuth';
import { use } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import ShareButton from '@/components/trip/ShareButton';
import GroupChat from '@/components/ai/GroupChat';
import TripSettingsModal from '@/components/trip/TripSettingsModal';
import TripMembersModal from '@/components/trip/TripMembersModal';
import { FloatingDock } from '@/components/ui/floating-dock';
import { IconDownload, IconSettings, IconMessageCircle, IconShare, IconUsers, IconNotes } from '@tabler/icons-react';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
  order_index: number | null;
  place_id?: string | null;
}

interface Cursor {
  user_id: string;
  lat: number;
  lng: number;
  color: string;
  user_name?: string;
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [trip, setTrip] = useState<{ name?: string; start_date?: string | null; end_date?: string | null; trip_days?: number | null } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [resetExistingItinerary, setResetExistingItinerary] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isMobileItineraryOpen, setIsMobileItineraryOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to home if not authenticated
      router.push('/');
      return;
    }

    if (user) {
      loadData();
      
      // Setup realtime subscription
      const realtimeChannel = subscribeToTrip(tripId, handleRealtimeEvent);
      setChannel(realtimeChannel);

      // Subscribe to places table changes (for AI-created places)
      const placesChannel = supabase
        .channel(`trip-places:${tripId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'places',
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            const newPlace = payload.new as Place;
            setPlaces((prev) => {
              if (prev.some((p) => p.id === newPlace.id)) {
                return prev;
              }
              return [...prev, newPlace];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'places',
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            const updatedPlace = payload.new as Place;
            setPlaces((prev) =>
              prev.map((p) => (p.id === updatedPlace.id ? updatedPlace : p))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'places',
            filter: `trip_id=eq.${tripId}`,
          },
          (payload) => {
            setPlaces((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        )
        .subscribe();

      // Broadcast initial cursor position after channel is ready
      setTimeout(() => {
        broadcastEvent(realtimeChannel, {
          type: 'cursor_move',
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email || 'User',
          lat: 35.6762,
          lng: 139.6503,
          color: 'var(--primary)',
        });
      }, 1000);

      // Cleanup on unmount
      return () => {
        realtimeChannel.unsubscribe();
        placesChannel.unsubscribe();
      };
    }
  }, [user, authLoading, tripId, router]);

  async function loadData() {
    const { data } = await getPlaces(tripId);
    setPlaces(data || []);
    
      // Load trip data to check ownership and get trip settings
      if (user) {
        const { data: tripData } = await getTrip(tripId);
        const trip = tripData as { 
          name?: string;
          created_by?: string; 
          start_date?: string | null; 
          end_date?: string | null; 
          trip_days?: number | null;
        } | null;
        
        setIsOwner(trip?.created_by === user.id);
        setTrip(trip || null);
      }
    
    setLoading(false);
  }

  function handleRealtimeEvent(event: RealtimeEvent) {
    switch (event.type) {
      case 'place_added':
        // Another user added a place
        setPlaces((prev) => {
          // Check if place already exists (avoid duplicates)
          if (prev.some((p) => p.id === event.place.id)) {
            return prev;
          }
          return [...prev, event.place];
        });
        break;

      case 'place_updated':
        // Another user updated a place
        setPlaces((prev) =>
          prev.map((p) => (p.id === event.id ? { ...p, ...event.updates } : p))
        );
        break;

      case 'place_deleted':
        // Another user deleted a place
        setPlaces((prev) => prev.filter((p) => p.id !== event.id));
        break;

      case 'cursor_move':
        // Don't show our own cursor
        if (user && event.user_id === user.id) {
          break;
        }
        setCursors((prev) => {
          const newCursors = new Map(prev);
          newCursors.set(event.user_id, {
            user_id: event.user_id,
            lat: event.lat,
            lng: event.lng,
            color: event.color,
            user_name: event.user_name,
          });
          return newCursors;
        });
        break;
    }
  }

  function handleMapMove(lat: number, lng: number) {
    if (!channel || !user) return;

    broadcastEvent(channel, {
      type: 'cursor_move',
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email || 'User',
      lat,
      lng,
      color: 'var(--primary)',
    });
  }

  async function handleMapClick(lat: number, lng: number) {
    if (!user) {
      alert('Please sign in to add places');
      return;
    }

    const newPlace = {
      trip_id: tripId,
      name: 'New Place',
      lat,
      lng,
      category: 'other' as const,
      created_by: user.id,
    };

    const { data } = await createPlace(newPlace);
    if (data) {
      setPlaces((prevPlaces) => [...prevPlaces, data]);
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_added',
          place: data,
        });
      }
    }
  }

  async function handleSearchResult(result: { id: string; name: string; lat: number; lng: number; address?: string }) {
    if (!user) {
      alert('Please sign in to add places');
      return;
    }

    const newPlace = {
      trip_id: tripId,
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      category: 'other' as const,
      address: result.address || null,
      created_by: user.id,
    };

    const { data } = await createPlace(newPlace);
    if (data) {
      setPlaces((prevPlaces) => [...prevPlaces, data]);
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_added',
          place: data,
        });
      }
    }
  }

  function handleMarkerClick(place: Place) {
    setSelectedPlace(place);
    setIsModalOpen(true);
  }

  async function handleSavePlace(id: string, name: string) {
    const { data } = await updatePlace(id, { name });
    if (data) {
      setPlaces((prevPlaces) => prevPlaces.map((p) => (p.id === id ? { ...p, name } : p)));
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_updated',
          id,
          updates: { name },
        });
      }
    }
  }

  async function handleDeletePlace(id: string) {
    const { error } = await deletePlace(id);
    if (!error) {
      setPlaces((prevPlaces) => prevPlaces.filter((p) => p.id !== id));
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_deleted',
          id,
        });
      }
    }
  }

  async function handlePlaceMoved(placeId: string, newDay: number | null, newOrder: number) {
    // Optimistic update - update UI immediately
    let previousPlaces: Place[] = [];
    setPlaces((prevPlaces) => {
      previousPlaces = [...prevPlaces];
      return prevPlaces.map((p) =>
        p.id === placeId ? { ...p, day_assigned: newDay, order_index: newOrder } : p
      );
    });

    // Then update database
    const { error } = await updatePlace(placeId, {
      day_assigned: newDay,
      order_index: newOrder,
    });

    if (error) {
      setPlaces(previousPlaces);
    } else {
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_updated',
          id: placeId,
          updates: { day_assigned: newDay, order_index: newOrder },
        });
      }
    }
  }

  async function handleDownloadItinerary() {
    try {
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please sign in to download the itinerary');
        return;
      }

      const response = await fetch(`/api/trips/${tripId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // Try to parse error as JSON, but handle if it's not JSON
        let errorMessage = 'Failed to download itinerary';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${trip?.name || 'trip'}_itinerary.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download itinerary. Please try again.';
      alert(message);
    }
  }

  async function handleGenerateItinerary() {
    setIsGenerating(true);

    try {
      // Get current places
      let placesToUse = places;
      
      // If reset is enabled, unassign all places first
      if (resetExistingItinerary) {
        try {
          // Unassign all places
          const resetPromises = places.map(async (place) => {
            if (place.day_assigned !== null) {
              await updatePlace(place.id, {
                day_assigned: null,
                order_index: null,
              });

              // Broadcast update
              if (channel) {
                broadcastEvent(channel, {
                  type: 'place_updated',
                  id: place.id,
                  updates: { day_assigned: null, order_index: null },
                });
              }
            }
          });
          
          await Promise.all(resetPromises);
          
          // Reload to get updated state
          await loadData();
          
          // Update placesToUse to reflect the reset (all places are now unassigned)
          placesToUse = places.map(p => ({ ...p, day_assigned: null, order_index: null }));
        } catch {
          setIsGenerating(false);
          alert('Failed to reset itinerary. Please try again.');
          return;
        }
      }

      // Get unassigned places (after potential reset)
      const unassignedPlaces = placesToUse.filter((p) => p.day_assigned === null);

      if (unassignedPlaces.length === 0) {
        alert('No unassigned places to organize. Add more places or drag them back to "Unassigned" first.');
        setIsGenerating(false);
        return;
      }

      // Special case: If only 1-2 unassigned places, assign them to nearest existing day
      // (Only if we didn't reset - if we reset, all places are unassigned so we need full clustering)
      if (unassignedPlaces.length < 3 && !resetExistingItinerary) {
        const assignedPlaces = places.filter((p) => p.day_assigned !== null);
        
        if (assignedPlaces.length === 0) {
          // No existing itinerary, need at least 3 places to create one
          alert('Add at least 3 places to generate a meaningful itinerary.');
          setIsGenerating(false);
          return;
        }

        // Group assigned places by day
        const placesByDay: Record<number, typeof assignedPlaces> = {};
        assignedPlaces.forEach((p) => {
          if (p.day_assigned) {
            if (!placesByDay[p.day_assigned]) {
              placesByDay[p.day_assigned] = [];
            }
            placesByDay[p.day_assigned].push(p);
          }
        });

        // For each unassigned place, find the nearest day's centroid
        for (const unassignedPlace of unassignedPlaces) {
          let nearestDay = 1;
          let minDistance = Infinity;

          // Calculate centroid for each day and find nearest
          for (const [dayStr, dayPlaces] of Object.entries(placesByDay)) {
            const day = parseInt(dayStr);
            if (dayPlaces.length === 0) continue;

            // Calculate centroid of this day
            const avgLat = dayPlaces.reduce((sum, p) => sum + p.lat, 0) / dayPlaces.length;
            const avgLng = dayPlaces.reduce((sum, p) => sum + p.lng, 0) / dayPlaces.length;

            // Calculate distance from unassigned place to day's centroid (in km)
            const distance = getDistance(
              unassignedPlace.lat,
              unassignedPlace.lng,
              avgLat,
              avgLng
            );

            if (distance < minDistance) {
              minDistance = distance;
              nearestDay = day;
            }
          }

          // Add to nearest day (at the end)
          const dayPlaces = placesByDay[nearestDay] || [];
          const maxOrder = dayPlaces.reduce((max, p) => Math.max(max, p.order_index || 0), -1);
          const newOrder = maxOrder + 1;

          await updatePlace(unassignedPlace.id, {
            day_assigned: nearestDay,
            order_index: newOrder,
          });

          // Broadcast update
          if (channel) {
            broadcastEvent(channel, {
              type: 'place_updated',
              id: unassignedPlace.id,
              updates: { day_assigned: nearestDay, order_index: newOrder },
            });
          }
        }

        // Reload data to reflect changes
        await loadData();
        setIsGenerating(false);
        return;
      }

      // Normal case: 3+ unassigned places, use full clustering
      // Use trip_days from trip settings, or calculate from dates, or default to 3
      let tripDays = 3;
      if (trip?.trip_days) {
        tripDays = trip.trip_days;
      } else if (trip?.start_date && trip?.end_date) {
        const start = new Date(trip.start_date);
        const end = new Date(trip.end_date);
        tripDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      }

      const response = await fetch('/api/ai/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: unassignedPlaces,
          tripDays,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate itinerary');
      }

      const { itinerary } = await response.json();

      // Update all places in database
      for (const day of itinerary) {
        for (const place of day.places) {
          await updatePlace(place.id, {
            day_assigned: day.day,
            order_index: place.order,
          });

          // Broadcast each update
          if (channel) {
            broadcastEvent(channel, {
              type: 'place_updated',
              id: place.id,
              updates: { day_assigned: day.day, order_index: place.order },
            });
          }
        }
      }

      // Reload data to reflect changes
      await loadData();
    } catch {
      alert('Failed to generate itinerary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-xl" style={{ color: 'var(--foreground)' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-xl" style={{ color: 'var(--foreground)' }}>Please sign in to view this trip</div>
      </div>
    );
  }

  const unassignedCount = places.filter((p) => p.day_assigned === null).length;

  // Create dock items
  const dockItems = [
    {
      title: 'Download Itinerary',
      icon: <IconDownload className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
      onClick: handleDownloadItinerary,
    },
    {
      title: 'Notes',
      icon: <IconNotes className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
      onClick: () => router.push(`/trip/${tripId}/notes`),
    },
    {
      title: 'Trip Members',
      icon: <IconUsers className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
      onClick: () => setShowMembersModal(true),
    },
    ...(isOwner
      ? [
          {
            title: 'Settings',
            icon: <IconSettings className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
            onClick: () => setIsSettingsOpen(true),
          },
        ]
      : []),
    {
      title: isChatOpen ? 'Close Chat' : 'Open Chat',
      icon: <IconMessageCircle className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
      onClick: () => setIsChatOpen(!isChatOpen),
    },
    ...(isOwner
      ? [
          {
            title: 'Share Trip',
            icon: <IconShare className="h-5 w-5" style={{ color: 'var(--foreground)' }} />,
            onClick: () => setShowShareModal(true),
          },
        ]
      : []),
  ];

  return (
    <>
      <FloatingDock items={dockItems} />
      <GroupChat tripId={tripId} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <TripMembersModal 
        tripId={tripId} 
        isOpen={showMembersModal} 
        onClose={() => setShowMembersModal(false)} 
      />
      {isOwner && (
        <ShareButton 
          tripId={tripId} 
          isOwner={isOwner} 
          open={showShareModal}
          onOpenChange={setShowShareModal}
          showButton={false}
        />
      )}
      <MapView 
        places={places} 
        onMapClick={handleMapClick}
        onMarkerClick={handleMarkerClick}
        cursors={Array.from(cursors.values())}
        onMapMove={handleMapMove}
        onSearchResult={handleSearchResult}
      />
      {/* Mobile Itinerary Toggle Button */}
      <button
        onClick={() => setIsMobileItineraryOpen(true)}
        className="sm:hidden fixed top-20 right-4 z-30 p-3 rounded-lg transition-colors"
        style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        aria-label="Open Itinerary"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: 'var(--foreground)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      
      <ItineraryPanel
        tripId={tripId}
        places={places}
        tripDays={
          trip?.trip_days || 
          (trip?.start_date && trip?.end_date
            ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
            : 3)
        }
        onPlaceMoved={handlePlaceMoved}
        onPlaceEdit={handleMarkerClick}
        isMobileOpen={isMobileItineraryOpen}
        onMobileClose={() => setIsMobileItineraryOpen(false)}
        onGenerateItinerary={handleGenerateItinerary}
        isGenerating={isGenerating}
        resetExistingItinerary={resetExistingItinerary}
        onResetChange={setResetExistingItinerary}
      />
      
      <TripSettingsModal
        tripId={tripId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialStartDate={trip?.start_date}
        initialEndDate={trip?.end_date}
        onUpdate={loadData}
      />
      
      {(unassignedCount > 0 || places.some(p => p.day_assigned !== null)) && (
        <div className="hidden sm:flex fixed bottom-8 right-8 z-20 flex-col items-end gap-3 sm:mr-[340px]">
          {/* Checkbox for reset option */}
          {places.some(p => p.day_assigned !== null) && (
            <label className="flex items-center gap-2 rounded-lg px-4 py-2 cursor-pointer transition-colors" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card)'}>
              <input
                type="checkbox"
                checked={resetExistingItinerary}
                onChange={(e) => setResetExistingItinerary(e.target.checked)}
                disabled={isGenerating}
                className="w-4 h-4 rounded"
                style={{
                  accentColor: 'var(--primary)',
                  borderColor: 'var(--border)'
                }}
              />
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Reset existing itinerary
              </span>
            </label>
          )}
          
          {/* Generate button */}
          <button
            onClick={handleGenerateItinerary}
            disabled={isGenerating || (unassignedCount === 0 && !resetExistingItinerary)}
            className="px-6 py-4 rounded-full transition-all duration-200 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--primary-foreground)',
              boxShadow: 'var(--shadow-2xl)'
            }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'scale(1.05)', e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.transform = 'scale(1)', e.currentTarget.style.opacity = '1')}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid var(--primary-foreground)', borderTopColor: 'transparent' }} />
                Generating...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                {resetExistingItinerary 
                  ? `Regenerate Itinerary (${places.length})`
                  : `Generate Itinerary (${unassignedCount})`
                }
              </>
            )}
          </button>
        </div>
      )}

      <PlaceModal
        place={selectedPlace}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlace}
        onDelete={handleDeletePlace}
      />
    </>
  );
}

