'use client';

import { useEffect, useState } from 'react';
import { getPlaces, createPlace, updatePlace, deletePlace } from '@/lib/supabase/client';
import MapView from '@/components/map/MapView';
import PlaceModal from '@/components/map/PlaceModal';
import ItineraryPanel from '@/components/itinerary/ItineraryPanel';
import { use } from 'react';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
  order_index: number | null;
}

export default function TripPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await getPlaces(tripId);
    setPlaces(data || []);
    setLoading(false);
  }

  function getUserId() {
    let userId = localStorage.getItem('trippee_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('trippee_user_id', userId);
    }
    return userId;
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
    } else {
      console.error('Failed to update place:', error);
    }
  }

  async function handleDeletePlace(id: string) {
    const { error } = await deletePlace(id);
    if (!error) {
      setPlaces(places.filter((p) => p.id !== id));
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

