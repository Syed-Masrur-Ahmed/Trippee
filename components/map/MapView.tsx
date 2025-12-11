'use client';

import Map, { Marker, MapMouseEvent, ViewStateChangeEvent } from 'react-map-gl/mapbox';
import { useState, useRef, useEffect } from 'react';
import SearchBar from './SearchBar';
import 'mapbox-gl/dist/mapbox-gl.css';

// Helper function to get CSS variable value
function getCSSVariable(variable: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

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
  user_name?: string;
}

interface SearchResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

interface MapViewProps {
  places: Place[];
  onMapClick: (lat: number, lng: number) => void;
  onMarkerClick?: (place: Place) => void;
  cursors?: Cursor[];
  onMapMove?: (lat: number, lng: number) => void;
  onSearchResult?: (result: SearchResult) => void;
}

export default function MapView({ places, onMapClick, onMarkerClick, cursors = [], onMapMove, onSearchResult }: MapViewProps) {
  const [viewport, setViewport] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 10,
  });
  const lastBroadcastTime = useRef(0);
  
  // Detect dark mode for map style
  const [isDark, setIsDark] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#5A5A5A'); // Fallback color
  
  useEffect(() => {
    // Check for dark mode class on html element
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    // Get primary color from CSS variable
    const updatePrimaryColor = () => {
      const color = getCSSVariable('--primary');
      if (color) {
        setPrimaryColor(color);
      }
    };
    
    checkDarkMode();
    updatePrimaryColor();
    
    // Watch for dark mode changes
    const observer = new MutationObserver(() => {
      checkDarkMode();
      updatePrimaryColor();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    // Also watch for style changes
    const styleObserver = new MutationObserver(updatePrimaryColor);
    styleObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });
    
    return () => {
      observer.disconnect();
      styleObserver.disconnect();
    };
  }, []);

  function handleMove(evt: ViewStateChangeEvent) {
    setViewport(evt.viewState);

    // Throttle cursor broadcasts to once per 100ms
    const now = Date.now();
    if (onMapMove && now - lastBroadcastTime.current > 100) {
      lastBroadcastTime.current = now;
      onMapMove(evt.viewState.latitude, evt.viewState.longitude);
    }
  }

  function handleSearchResult(result: SearchResult) {
    // Pan map to result location
    setViewport({
      ...viewport,
      latitude: result.lat,
      longitude: result.lng,
      zoom: 14,
    });

    // Call parent handler if provided
    if (onSearchResult) {
      onSearchResult(result);
    }
  }

  return (
    <div className="fixed left-0 top-0 h-screen z-0" style={{ width: 'calc(100% - 320px)' }}>
      <Map
        {...viewport}
        onMove={handleMove}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        style={{ width: '100%', height: '100vh' }}
        mapStyle={isDark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11"}
        onClick={(e: MapMouseEvent) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
      >
        {places.map((place) => (
          <Marker key={place.id} latitude={place.lat} longitude={place.lng} anchor="bottom">
            <div
              className="cursor-pointer transition-transform hover:scale-110"
              style={{
                transform: 'translateX(-50%)',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onMarkerClick?.(place);
              }}
            >
              {/* Google Maps style pin marker with theme colors */}
              <svg
                width="32"
                height="40"
                viewBox="0 0 32 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
              >
                {/* Pin shadow */}
                <ellipse cx="16" cy="36" rx="6" ry="2" fill="rgba(0,0,0,0.2)" />
                {/* Pin body with theme primary color */}
                <path
                  d="M16 2C10.477 2 6 6.477 6 12C6 18 16 30 16 30C16 30 26 18 26 12C26 6.477 21.523 2 16 2Z"
                  fill={primaryColor}
                  stroke={primaryColor}
                  strokeWidth="1"
                  strokeOpacity="0.8"
                />
                {/* White circle at top */}
                <circle cx="16" cy="12" r="6" fill="white" />
              </svg>
            </div>
          </Marker>
        ))}

        {cursors.map((cursor) => (
          <Marker key={cursor.user_id} latitude={cursor.lat} longitude={cursor.lng}>
            <div className="relative">
              <div
                className="w-4 h-4 rounded-full border-2 shadow-lg"
                style={{ 
                  backgroundColor: 'var(--primary)',
                  borderColor: 'var(--background)'
                }}
              />
              <div
                className="absolute top-5 left-0 text-xs font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap"
                style={{ 
                  backgroundColor: 'var(--primary)', 
                  color: 'var(--primary-foreground)',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                {cursor.user_name || `User ${cursor.user_id.slice(0, 4)}`}
              </div>
            </div>
          </Marker>
        ))}
      </Map>

      <div className="absolute top-20 left-4 z-[60]">
        <SearchBar onSelectResult={handleSearchResult} />
      </div>
    </div>
  );
}