'use client';

import { useEffect, useState } from 'react';
import { getPlaces, createPlace, updatePlace, deletePlace } from '@/lib/supabase/client';
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

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
  order_index: number | null;
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

  useEffect(() => {
    if (!authLoading && !user) {
      // Redirect to home if not authenticated
      router.push('/');
      return;
    }

    if (user) {
      loadData();
      
      const myUserId = user.id;
      const myColor = getUserColor(user.id);
      console.log('My user ID:', myUserId);
      console.log('My color:', myColor);
      
      // Setup realtime subscription
      const realtimeChannel = subscribeToTrip(tripId, handleRealtimeEvent);
      setChannel(realtimeChannel);
      console.log('Subscribed to trip:', tripId);

      // Broadcast initial cursor position after channel is ready
      setTimeout(() => {
        console.log('Broadcasting initial cursor position');
        broadcastEvent(realtimeChannel, {
          type: 'cursor_move',
          user_id: myUserId,
          user_name: user.user_metadata?.full_name || user.email || 'User',
          lat: 35.6762,
          lng: 139.6503,
          color: myColor,
        });
      }, 1000);

      // Cleanup on unmount
      return () => {
        realtimeChannel.unsubscribe();
      };
    }
  }, [user, authLoading, tripId, router]);

  async function loadData() {
    const { data } = await getPlaces(tripId);
    setPlaces(data || []);
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
        // Another user moved their cursor
        // Don't show our own cursor
        if (user && event.user_id === user.id) {
          break;
        }
        console.log('Received cursor from:', event.user_id.slice(0, 8), 'at', event.lat, event.lng);
        setCursors((prev) => {
          const newCursors = new Map(prev);
          newCursors.set(event.user_id, {
            user_id: event.user_id,
            lat: event.lat,
            lng: event.lng,
            color: event.color,
            user_name: event.user_name,
          });
          console.log('Total cursors:', newCursors.size);
          return newCursors;
        });
        break;
    }
  }

  function getUserColor(userId: string) {
    // Generate consistent color based on user ID
    const colors = [
      '#ef4444', // red
      '#f59e0b', // orange
      '#10b981', // green
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#06b6d4', // cyan
    ];
    // Use first character of user ID to pick color consistently
    const index = parseInt(userId[0], 16) % colors.length;
    return colors[index];
  }

  function handleMapMove(lat: number, lng: number) {
    if (!channel || !user) return;

    console.log('Broadcasting cursor at:', lat, lng);
    // Broadcast cursor position (throttled by the caller)
    broadcastEvent(channel, {
      type: 'cursor_move',
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email || 'User',
      lat,
      lng,
      color: getUserColor(user.id),
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

    const { data, error } = await createPlace(newPlace);
    if (data) {
      setPlaces((prevPlaces) => [...prevPlaces, data]);
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_added',
          place: data,
        });
      }
    } else {
      console.error('Failed to create place:', error);
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

    const { data, error } = await createPlace(newPlace);
    if (data) {
      setPlaces((prevPlaces) => [...prevPlaces, data]);
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_added',
          place: data,
        });
      }
    } else {
      console.error('Failed to create place from search:', error);
    }
  }

  function handleMarkerClick(place: Place) {
    setSelectedPlace(place);
    setIsModalOpen(true);
  }

  async function handleSavePlace(id: string, name: string) {
    const { data, error } = await updatePlace(id, { name });
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
    } else {
      console.error('Failed to update place:', error);
    }
  }

  async function handleDeletePlace(id: string) {
    const { error } = await deletePlace(id);
    if (!error) {
      // Use functional update to avoid stale state
      setPlaces((prevPlaces) => prevPlaces.filter((p) => p.id !== id));
      
      // Broadcast to other users
      if (channel) {
        broadcastEvent(channel, {
          type: 'place_deleted',
          id,
        });
      }
    } else {
      console.error('Failed to delete place:', error);
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
      // Revert on error
      console.error('Failed to move place:', error);
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

  async function handleGenerateItinerary() {
    // Get only unassigned places (get current state)
    const currentPlaces = places;
    const unassignedPlaces = currentPlaces.filter((p) => p.day_assigned === null);

    if (unassignedPlaces.length === 0) {
      alert('No unassigned places to organize. Add more places or drag them back to "Unassigned" first.');
      return;
    }

    setIsGenerating(true);

    try {
      // Special case: If only 1-2 unassigned places, assign them to nearest existing day
      if (unassignedPlaces.length < 3) {
        const assignedPlaces = currentPlaces.filter((p) => p.day_assigned !== null);
        
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
      const response = await fetch('/api/ai/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: unassignedPlaces,
          tripDays: 3,
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
    } catch (error) {
      console.error('Failed to generate itinerary:', error);
      alert('Failed to generate itinerary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Please sign in to view this trip</div>
      </div>
    );
  }

  const unassignedCount = places.filter((p) => p.day_assigned === null).length;

  return (
    <>
      <MapView 
        places={places} 
        onMapClick={handleMapClick}
        onMarkerClick={handleMarkerClick}
        cursors={Array.from(cursors.values())}
        onMapMove={handleMapMove}
        onSearchResult={handleSearchResult}
      />
      <ItineraryPanel
        places={places}
        tripDays={3}
        onPlaceMoved={handlePlaceMoved}
        onPlaceEdit={handleMarkerClick}
      />
      
      {unassignedCount > 0 && (
        <button
          onClick={handleGenerateItinerary}
          disabled={isGenerating}
          className="fixed bottom-8 right-8 z-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-200 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ marginRight: '340px' }}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
              Generate Itinerary ({unassignedCount})
            </>
          )}
        </button>
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

