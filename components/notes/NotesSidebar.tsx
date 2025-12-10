'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
}

interface NotesSidebarProps {
  tripId: string;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string | null) => void;
}

export default function NotesSidebar({ tripId, selectedPlaceId, onSelectPlace }: NotesSidebarProps) {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlaces();
  }, [tripId]);

  async function loadPlaces() {
    try {
      const { data, error } = await supabase
        .from('places')
        .select('id, name, lat, lng, day_assigned')
        .eq('trip_id', tripId)
        .order('day_assigned', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (!error) {
        setPlaces(data || []);
      }
    } catch {
      // Error loading places - fail silently
    } finally {
      setLoading(false);
    }
  }

  // Group places by day
  const placesByDay: Record<number, Place[]> = {};
  const unassignedPlaces: Place[] = [];

  places.forEach((place) => {
    if (place.day_assigned) {
      if (!placesByDay[place.day_assigned]) {
        placesByDay[place.day_assigned] = [];
      }
      placesByDay[place.day_assigned].push(place);
    } else {
      unassignedPlaces.push(place);
    }
  });

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--card)' }}>
      {/* Header */}
      <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Notes</h2>
      </div>

      {/* Places List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }}></div>
          </div>
        ) : (
          <div className="p-2">
            {/* General Trip Notes */}
            <button
              onClick={() => onSelectPlace(null)}
              className="w-full text-left p-3 rounded-lg transition-colors mb-2"
              style={{
                backgroundColor: selectedPlaceId === null ? 'var(--accent)' : 'transparent',
                border: selectedPlaceId === null ? '1px solid var(--primary)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (selectedPlaceId !== null) {
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPlaceId !== null) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                General Trip Notes
              </div>
            </button>

            {/* Unassigned Places */}
            {unassignedPlaces.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-semibold uppercase mb-2 px-2" style={{ color: 'var(--muted-foreground)' }}>
                  Unassigned
                </h3>
                {unassignedPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => onSelectPlace(place.id)}
                    className="w-full text-left p-2 rounded-lg transition-colors mb-1"
                    style={{
                      backgroundColor: selectedPlaceId === place.id ? 'var(--accent)' : 'transparent',
                      border: selectedPlaceId === place.id ? '1px solid var(--primary)' : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedPlaceId !== place.id) {
                        e.currentTarget.style.backgroundColor = 'var(--accent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedPlaceId !== place.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                      {place.name}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Places by Day */}
            {Object.keys(placesByDay).map((day) => {
              const dayNum = parseInt(day);
              return (
                <div key={day} className="mb-4">
                  <h3 className="text-xs font-semibold uppercase mb-2 px-2" style={{ color: 'var(--primary)' }}>
                    Day {dayNum}
                  </h3>
                  {placesByDay[dayNum].map((place) => (
                    <button
                      key={place.id}
                      onClick={() => onSelectPlace(place.id)}
                      className="w-full text-left p-2 rounded-lg transition-colors mb-1"
                      style={{
                        backgroundColor: selectedPlaceId === place.id ? 'var(--accent)' : 'transparent',
                        border: selectedPlaceId === place.id ? '1px solid var(--primary)' : '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPlaceId !== place.id) {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPlaceId !== place.id) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                        {place.name}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

