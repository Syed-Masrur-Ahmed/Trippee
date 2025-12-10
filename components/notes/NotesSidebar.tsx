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

// Selection can be: null (general notes), place ID, or day number (prefixed with "day-")
export type NoteSelection = string | null;

interface NotesSidebarProps {
  tripId: string;
  tripDays?: number;
  selectedNote: NoteSelection;
  onSelectNote: (selection: NoteSelection) => void;
}

export default function NotesSidebar({ tripId, tripDays = 3, selectedNote, onSelectNote }: NotesSidebarProps) {
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

  // Helper to check if a day is selected
  const isDaySelected = (day: number) => selectedNote === `day-${day}`;
  const isPlaceSelected = (placeId: string) => selectedNote === placeId;
  const isGeneralSelected = selectedNote === null;

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
              onClick={() => onSelectNote(null)}
              className="w-full text-left p-3 rounded-lg transition-colors mb-2"
              style={{
                backgroundColor: isGeneralSelected ? 'var(--accent)' : 'transparent',
                border: isGeneralSelected ? '1px solid var(--primary)' : '1px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isGeneralSelected) {
                  e.currentTarget.style.backgroundColor = 'var(--accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isGeneralSelected) {
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
                    onClick={() => onSelectNote(place.id)}
                    className="w-full text-left p-2 rounded-lg transition-colors mb-1"
                    style={{
                      backgroundColor: isPlaceSelected(place.id) ? 'var(--accent)' : 'transparent',
                      border: isPlaceSelected(place.id) ? '1px solid var(--primary)' : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isPlaceSelected(place.id)) {
                        e.currentTarget.style.backgroundColor = 'var(--accent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isPlaceSelected(place.id)) {
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

            {/* Days and Places by Day */}
            {Array.from({ length: tripDays }, (_, i) => i + 1).map((dayNum) => {
              const dayPlaces = placesByDay[dayNum] || [];
              return (
                <div key={dayNum} className="mb-4">
                  <h3 className="text-xs font-semibold uppercase mb-2 px-2" style={{ color: 'var(--primary)' }}>
                    Day {dayNum}
                  </h3>
                  {/* Day Notes Button */}
                  <button
                    onClick={() => onSelectNote(`day-${dayNum}`)}
                    className="w-full text-left p-2 rounded-lg transition-colors mb-1"
                    style={{
                      backgroundColor: isDaySelected(dayNum) ? 'var(--accent)' : 'transparent',
                      border: isDaySelected(dayNum) ? '1px solid var(--primary)' : '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDaySelected(dayNum)) {
                        e.currentTarget.style.backgroundColor = 'var(--accent)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDaySelected(dayNum)) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div className="font-medium text-sm flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--primary)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Day {dayNum} Notes
                    </div>
                  </button>
                  {/* Places for this day */}
                  {dayPlaces.map((place) => (
                    <button
                      key={place.id}
                      onClick={() => onSelectNote(place.id)}
                      className="w-full text-left p-2 pl-6 rounded-lg transition-colors mb-1"
                      style={{
                        backgroundColor: isPlaceSelected(place.id) ? 'var(--accent)' : 'transparent',
                        border: isPlaceSelected(place.id) ? '1px solid var(--primary)' : '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isPlaceSelected(place.id)) {
                          e.currentTarget.style.backgroundColor = 'var(--accent)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isPlaceSelected(place.id)) {
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

