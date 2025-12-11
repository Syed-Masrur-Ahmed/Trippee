'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { supabase } from '@/lib/supabase/client';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
  order_index: number | null;
  place_id?: string | null;
}

interface ItineraryPanelProps {
  tripId: string;
  places: Place[];
  tripDays?: number;
  onPlaceMoved?: (placeId: string, newDay: number | null, newOrder: number) => void;
  onPlaceEdit?: (place: Place) => void;
  // Mobile drawer props
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  // Generate itinerary props (for mobile)
  onGenerateItinerary?: () => void;
  isGenerating?: boolean;
  resetExistingItinerary?: boolean;
  onResetChange?: (reset: boolean) => void;
}

// Helper function to extract text from Tiptap JSON content
function extractTextFromTiptap(content: any): string {
  if (!content || typeof content !== 'object') return '';
  
  let text = '';
  
  function traverse(node: any) {
    if (node.type === 'text' && node.text) {
      text += node.text + ' ';
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }
  
  if (content.type === 'doc' && content.content) {
    content.content.forEach(traverse);
  }
  
  return text.trim();
}

// Get first few words from text (for preview)
function getPreviewText(text: string, maxWords: number = 5): string {
  if (!text) return '';
  const words = text.split(/\s+/).slice(0, maxWords);
  const preview = words.join(' ');
  return text.split(/\s+/).length > maxWords ? preview + '...' : preview;
}

function DraggablePlace({
  place,
  index,
  onEdit,
}: {
  place: Place;
  index?: number;
  onEdit?: (place: Place) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: place.id,
    data: { place },
    disabled: false,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  function handleMenuClick(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit?.(place);
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...style,
        backgroundColor: place.day_assigned ? 'var(--accent)' : 'var(--muted)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.75rem',
        transition: 'background-color 0.2s',
        cursor: 'move',
      }}
      className="relative"
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = place.day_assigned ? 'var(--secondary)' : 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = place.day_assigned ? 'var(--accent)' : 'var(--muted)';
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 flex items-start gap-2">
          {index !== undefined && (
            <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              {index + 1}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{place.name}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            </div>
            <a
              href={place.place_id 
                ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
                : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
              }
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
              }}
              className="text-xs transition-colors underline whitespace-nowrap inline-block mt-1.5"
              style={{ color: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Open on Google Maps
            </a>
          </div>
        </div>
        <button
          onClick={handleMenuClick}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          className="p-1 rounded transition-colors flex-shrink-0"
          style={{ color: 'var(--muted-foreground)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          aria-label="Edit place"
        >
          <svg
            className="w-5 h-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DroppableZone({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className="space-y-2 min-h-[50px] transition-colors"
      style={{
        backgroundColor: isOver ? 'var(--accent)' : 'transparent',
        borderRadius: isOver ? 'var(--radius-lg)' : '0',
        padding: isOver ? '0.5rem' : '0'
      }}
    >
      {children}
    </div>
  );
}

export default function ItineraryPanel({
  tripId,
  places,
  tripDays = 3,
  onPlaceMoved,
  onPlaceEdit,
  isMobileOpen = false,
  onMobileClose,
  onGenerateItinerary,
  isGenerating = false,
  resetExistingItinerary = false,
  onResetChange,
}: ItineraryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);
  const [dayNotes, setDayNotes] = useState<Record<number, string>>({});

  // Fetch day notes
  useEffect(() => {
    async function loadDayNotes() {
      if (!tripId) return;
      
      const { data } = await supabase
        .from('notes')
        .select('day_number, content')
        .eq('trip_id', tripId)
        .not('day_number', 'is', null);
      
      if (data) {
        const notesMap: Record<number, string> = {};
        data.forEach((note: any) => {
          if (note.day_number && note.content) {
            const text = extractTextFromTiptap(note.content);
            if (text) {
              notesMap[note.day_number] = getPreviewText(text, 4);
            }
          }
        });
        setDayNotes(notesMap);
      }
    }
    loadDayNotes();
  }, [tripId]);

  // Group places by day
  const unassignedPlaces = places.filter((p) => p.day_assigned === null);

  const dayGroups: Record<number, Place[]> = {};
  for (let day = 1; day <= tripDays; day++) {
    dayGroups[day] = places
      .filter((p) => p.day_assigned === day)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }

  function handleDragStart(event: DragStartEvent) {
    const place = event.active.data.current?.place;
    setActivePlace(place);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActivePlace(null);

    if (!over || !onPlaceMoved) return;

    const placeId = active.id as string;
    const targetZone = over.id as string;

    if (targetZone === 'unassigned') {
      onPlaceMoved(placeId, null, 0);
    } else if (targetZone.startsWith('day-')) {
      const day = parseInt(targetZone.split('-')[1]);
      const currentDayPlaces = dayGroups[day] || [];
      onPlaceMoved(placeId, day, currentDayPlaces.length);
    }
  }

  // On desktop: show collapsed button when collapsed
  // On mobile: the panel is controlled by parent via isMobileOpen prop
  if (isCollapsed) {
    return (
      <div className="hidden sm:block fixed right-4 top-4 z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="rounded-lg p-3 transition-colors"
          style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--card)'}
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
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onMobileClose}
        />
      )}
      
      {/* Panel - responsive: drawer on mobile, fixed sidebar on desktop */}
      <div 
        className={`
          fixed top-0 h-screen overflow-y-auto flex flex-col z-50
          w-full sm:w-80 right-0
          transform transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : 'translate-x-full'}
          sm:translate-x-0 sm:z-10
        `}
        style={{ 
          backgroundColor: 'var(--card)', 
          boxShadow: 'var(--shadow-2xl)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Itinerary</h2>
          {/* Desktop collapse button */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="hidden sm:block p-2 rounded-lg transition-colors"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          {/* Mobile close button */}
          <button
            onClick={onMobileClose}
            className="sm:hidden p-2 rounded-lg transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Generate Itinerary Button - shown above Unassigned section */}
        {onGenerateItinerary && (unassignedPlaces.length > 0 || places.some(p => p.day_assigned !== null)) && (
          <div className="sm:hidden p-4" style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Reset checkbox */}
            {places.some(p => p.day_assigned !== null) && onResetChange && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetExistingItinerary}
                  onChange={(e) => onResetChange(e.target.checked)}
                  disabled={isGenerating}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                  Reset existing itinerary
                </span>
              </label>
            )}
            {/* Generate button */}
            <button
              onClick={onGenerateItinerary}
              disabled={isGenerating || (unassignedPlaces.length === 0 && !resetExistingItinerary)}
              className="w-full px-4 py-3 rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid var(--primary-foreground)', borderTopColor: 'transparent' }} />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {resetExistingItinerary 
                    ? `Regenerate Itinerary (${places.length})`
                    : `Generate Itinerary (${unassignedPlaces.length})`
                  }
                </>
              )}
            </button>
          </div>
        )}

        {/* Unassigned Section */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase" style={{ color: 'var(--muted-foreground)' }}>
              Unassigned ({unassignedPlaces.length})
            </h3>
            {unassignedPlaces.length > 0 && (
              <button
                onClick={() => setIsUnassignedCollapsed(!isUnassignedCollapsed)}
                className="p-1 rounded transition-colors"
                style={{ color: 'var(--foreground)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                aria-label={isUnassignedCollapsed ? 'Expand' : 'Collapse'}
              >
                <svg
                  className={`w-4 h-4 transform transition-transform ${isUnassignedCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            )}
          </div>
          {!isUnassignedCollapsed && (
            <div className="px-4 pb-4 max-h-64 overflow-y-auto">
              <DroppableZone id="unassigned">
                {unassignedPlaces.length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>No unassigned places</p>
                ) : (
                  unassignedPlaces.map((place) => (
                    <DraggablePlace
                      key={place.id}
                      place={place}
                      onEdit={onPlaceEdit}
                    />
                  ))
                )}
              </DroppableZone>
            </div>
          )}
        </div>

        {/* Day Sections */}
        <div className="flex-1 overflow-y-auto pb-20 sm:pb-0">
          {Array.from({ length: tripDays }, (_, i) => i + 1).map((day) => (
            <div key={day} className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-sm font-semibold uppercase" style={{ color: 'var(--primary)' }}>
                  Day {day} ({dayGroups[day]?.length || 0})
                </h3>
                {dayNotes[day] && (
                  <span 
                    className="text-xs italic truncate max-w-[140px]" 
                    style={{ color: 'var(--muted-foreground)' }}
                    title={dayNotes[day]}
                  >
                    — {dayNotes[day]}
                  </span>
                )}
              </div>
              <DroppableZone id={`day-${day}`}>
                {!dayGroups[day] || dayGroups[day].length === 0 ? (
                  <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>No places assigned</p>
                ) : (
                  dayGroups[day].map((place, index) => (
                    <DraggablePlace
                      key={place.id}
                      place={place}
                      index={index}
                      onEdit={onPlaceEdit}
                    />
                  ))
                )}
              </DroppableZone>
            </div>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activePlace ? <DraggablePlace place={activePlace} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

