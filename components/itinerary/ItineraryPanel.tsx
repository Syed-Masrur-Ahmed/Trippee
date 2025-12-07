'use client';

import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  day_assigned: number | null;
  order_index: number | null;
}

interface ItineraryPanelProps {
  places: Place[];
  tripDays?: number;
  onPlaceMoved?: (placeId: string, newDay: number | null, newOrder: number) => void;
  onPlaceEdit?: (place: Place) => void;
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
      style={style}
      className={`${
        place.day_assigned ? 'bg-blue-50' : 'bg-gray-50'
      } rounded-lg p-3 hover:${
        place.day_assigned ? 'bg-blue-100' : 'bg-gray-100'
      } transition-colors relative`}
    >
      <div className="flex items-start gap-2">
        <div
          {...listeners}
          {...attributes}
          className="flex-1 flex items-start gap-2 cursor-move"
        >
          {index !== undefined && (
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {index + 1}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-black">{place.name}</div>
            <div className="text-xs text-gray-700 mt-1">
              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            </div>
          </div>
        </div>
        <button
          onClick={handleMenuClick}
          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          aria-label="Edit place"
        >
          <svg
            className="w-5 h-5 text-gray-600"
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
      className={`space-y-2 min-h-[50px] transition-colors ${
        isOver ? 'bg-blue-50 rounded-lg p-2' : ''
      }`}
    >
      {children}
    </div>
  );
}

export default function ItineraryPanel({
  places,
  tripDays = 3,
  onPlaceMoved,
  onPlaceEdit,
}: ItineraryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUnassignedCollapsed, setIsUnassignedCollapsed] = useState(false);
  const [activePlace, setActivePlace] = useState<Place | null>(null);

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

  if (isCollapsed) {
    return (
      <div className="fixed right-4 top-4 z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="bg-white rounded-lg shadow-lg p-3 hover:bg-gray-50 transition-colors"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
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
      <div className="fixed right-0 top-0 h-screen w-80 bg-white shadow-2xl overflow-y-auto z-10 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Itinerary</h2>
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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

        {/* Unassigned Section */}
        <div className="border-b border-gray-200">
          <div className="p-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-600 uppercase">
              Unassigned ({unassignedPlaces.length})
            </h3>
            {unassignedPlaces.length > 0 && (
              <button
                onClick={() => setIsUnassignedCollapsed(!isUnassignedCollapsed)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                  <p className="text-sm text-gray-600 italic">No unassigned places</p>
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
        <div className="flex-1 overflow-y-auto">
          {Array.from({ length: tripDays }, (_, i) => i + 1).map((day) => (
            <div key={day} className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-blue-600 mb-2 uppercase">
                Day {day} ({dayGroups[day]?.length || 0})
              </h3>
              <DroppableZone id={`day-${day}`}>
                {!dayGroups[day] || dayGroups[day].length === 0 ? (
                  <p className="text-sm text-gray-600 italic">No places assigned</p>
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

