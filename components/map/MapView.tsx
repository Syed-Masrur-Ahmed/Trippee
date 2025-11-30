'use client';

import Map, { Marker, MapMouseEvent, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  places: Array<{ id: string; lat: number; lng: number; name: string }>;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick?: (place: { id: string; lat: number; lng: number; name: string }) => void;
}

export default function MapView({ places, onMapClick, onMarkerClick }: MapViewProps) {
  const [viewport, setViewport] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 10,
  });

  return (
    <Map
      {...viewport}
      onMove={(evt: ViewStateChangeEvent) => setViewport(evt.viewState)}
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
    </Map>
  );
}