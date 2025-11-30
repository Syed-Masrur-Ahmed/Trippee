'use client';

import Map, { Marker, MapMouseEvent, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { useState, useRef, useEffect } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Place {
  id: string;
  lat: number;
  lng: number;
  name: string;
  day_assigned: number | null;
  order_index: number | null;
}

interface Cursor {
  user_id: string;
  lat: number;
  lng: number;
  color: string;
}

interface MapViewProps {
  places: Place[];
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick?: (place: Place) => void;
  cursors?: Cursor[];
  onMapMove?: (lat: number, lng: number) => void;
}

export default function MapView({ places, onMapClick, onMarkerClick, cursors = [], onMapMove }: MapViewProps) {
  const [viewport, setViewport] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 10,
  });
  const lastBroadcastTime = useRef(0);

  function handleMove(evt: ViewStateChangeEvent) {
    setViewport(evt.viewState);

    // Throttle cursor broadcasts to once per 100ms
    const now = Date.now();
    if (onMapMove && now - lastBroadcastTime.current > 100) {
      lastBroadcastTime.current = now;
      onMapMove(evt.viewState.latitude, evt.viewState.longitude);
    }
  }

  return (
    <Map
      {...viewport}
      onMove={handleMove}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      style={{ width: '100%', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onClick={(e: MapMouseEvent) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
    >
      {places.map((place) => (
        <Marker key={place.id} latitude={place.lat} longitude={place.lng}>
          <div
            className="w-8 h-8 bg-red-500 rounded-full border-2 border-white cursor-pointer hover:bg-red-600 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick?.(place);
            }}
          />
        </Marker>
      ))}

      {cursors.map((cursor) => (
        <Marker key={cursor.user_id} latitude={cursor.lat} longitude={cursor.lng}>
          <div className="relative">
            <div
              className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="absolute top-5 left-0 text-xs font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap"
              style={{ backgroundColor: cursor.color, color: 'white' }}
            >
              User {cursor.user_id.slice(0, 4)}
            </div>
          </div>
        </Marker>
      ))}
    </Map>
  );
}