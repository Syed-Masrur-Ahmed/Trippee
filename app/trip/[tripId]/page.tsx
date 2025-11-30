'use client';

import { useEffect, useState } from 'react';
import { getPlaces, createPlace, updatePlace, deletePlace } from '@/lib/supabase/client';
import MapView from '@/components/map/MapView';
import PlaceModal from '@/components/map/PlaceModal';
import ItineraryPanel from '@/components/itinerary/ItineraryPanel';
import { subscribeToTrip, broadcastEvent, RealtimeEvent } from '@/lib/supabase/realtime';
import { use } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

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
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());

  useEffect(() => {
    loadData();
    
    const myUserId = getUserId();
    const myColor = getUserColor();
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
        lat: 35.6762,
        lng: 139.6503,
        color: myColor,
      });
    }, 1000);

    // Cleanup on unmount
    return () => {
      realtimeChannel.unsubscribe();
    };
  }, []);

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
        if (event.user_id === getUserId()) {
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
          });
          console.log('Total cursors:', newCursors.size);
          return newCursors;
        });
        break;
    }
  }

  function getUserId() {
    if (typeof window === 'undefined') return 'server';
    
    let userId = localStorage.getItem('trippee_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('trippee_user_id', userId);
    }
    return userId;
  }

  function getUserColor() {
    if (typeof window === 'undefined') return '#000000';
    
    let color = localStorage.getItem('trippee_user_color');
    if (!color) {
      // Generate a random color for this user
      const colors = [
        '#ef4444', // red
        '#f59e0b', // orange
        '#10b981', // green
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#ec4899', // pink
        '#06b6d4', // cyan
      ];
      color = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('trippee_user_color', color);
    }
    return color;
  }

  function handleMapMove(lat: number, lng: number) {
    if (!channel) return;

    console.log('Broadcasting cursor at:', lat, lng);
    // Broadcast cursor position (throttled by the caller)
    broadcastEvent(channel, {
      type: 'cursor_move',
      user_id: getUserId(),
      lat,
      lng,
      color: getUserColor(),
    });
  }

  async function handleMapClick(lat: number, lng: number) {
    const newPlace = {
      trip_id: tripId,
      name: 'New Place',
      lat,
      lng,
      category: 'other' as const,
      created_by: getUserId(),
    };

    const { data, error } = await createPlace(newPlace);
    if (data) {
      setPlaces([...places, data]);
      
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

  function handleMarkerClick(place: Place) {
    setSelectedPlace(place);
    setIsModalOpen(true);
  }

  async function handleSavePlace(id: string, name: string) {
    const { data, error } = await updatePlace(id, { name });
    if (data) {
      setPlaces(places.map((p) => (p.id === id ? { ...p, name } : p)));
      
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
      setPlaces(places.filter((p) => p.id !== id));
      
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
    const previousPlaces = [...places];
    setPlaces(
      places.map((p) =>
        p.id === placeId ? { ...p, day_assigned: newDay, order_index: newOrder } : p
      )
    );

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">Loading map...</div>
      </div>
    );
  }

  return (
    <>
      <MapView 
        places={places} 
        onMapClick={handleMapClick}
        onMarkerClick={handleMarkerClick}
        cursors={Array.from(cursors.values())}
        onMapMove={handleMapMove}
      />
      <ItineraryPanel places={places} tripDays={3} onPlaceMoved={handlePlaceMoved} />
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

