'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconMenu2, IconX, IconNotes, IconCalendar, IconMapPin } from '@tabler/icons-react';
import NotesSidebar, { type NoteSelection } from './NotesSidebar';
import NotesEditor from './NotesEditor';
import { supabase } from '@/lib/supabase/client';

interface NotesLayoutProps {
  tripId: string;
}

interface Place {
  id: string;
  name: string;
}

export default function NotesLayout({ tripId }: NotesLayoutProps) {
  const [selectedNote, setSelectedNote] = useState<NoteSelection>(null);
  const [tripDays, setTripDays] = useState(3);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const router = useRouter();

  // Load trip days and places
  useEffect(() => {
    async function loadTripData() {
      // Load trip info
      const { data: tripData } = await supabase
        .from('trips')
        .select('trip_days, start_date, end_date')
        .eq('id', tripId)
        .single();
      
      if (tripData) {
        const trip = tripData as { trip_days?: number; start_date?: string | null; end_date?: string | null };
        if (trip.trip_days) {
          setTripDays(trip.trip_days);
        } else if (trip.start_date && trip.end_date) {
          const start = new Date(trip.start_date);
          const end = new Date(trip.end_date);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          setTripDays(days);
        }
      }

      // Load places for title generation
      const { data: placesData } = await supabase
        .from('places')
        .select('id, name')
        .eq('trip_id', tripId);
      
      if (placesData) {
        setPlaces(placesData as Place[]);
      }
    }
    loadTripData();
  }, [tripId]);

  // Get the title for the current note selection
  const getNoteTitle = useCallback(() => {
    if (selectedNote === null) {
      return 'General Trip Notes';
    }
    if (selectedNote.startsWith('day-')) {
      const dayNum = selectedNote.replace('day-', '');
      return `Day ${dayNum} Notes`;
    }
    // It's a place ID
    const place = places.find(p => p.id === selectedNote);
    return place?.name || 'Place Notes';
  }, [selectedNote, places]);

  // Get icon for current note
  const getNoteIcon = () => {
    if (selectedNote === null) {
      return <IconNotes className="w-4 h-4" />;
    }
    if (selectedNote.startsWith('day-')) {
      return <IconCalendar className="w-4 h-4" />;
    }
    return <IconMapPin className="w-4 h-4" />;
  };

  // Close sidebar when note is selected on mobile
  function handleSelectNote(selection: NoteSelection) {
    setSelectedNote(selection);
    setIsMobileSidebarOpen(false);
  }

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Mobile Header - Full width, shows current note */}
      <div 
        className="sm:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-2 py-3" 
        style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        {/* Back button */}
        <button
          onClick={() => router.push(`/trip/${tripId}`)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--foreground)' }}
          aria-label="Back to trip"
        >
          <IconArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Current note title */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0 px-2">
          <span style={{ color: 'var(--primary)' }}>{getNoteIcon()}</span>
          <span 
            className="font-medium text-sm truncate" 
            style={{ color: 'var(--foreground)' }}
          >
            {getNoteTitle()}
          </span>
        </div>
        
        {/* Menu button */}
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--foreground)' }}
          aria-label="Open notes menu"
        >
          {isMobileSidebarOpen ? <IconX className="w-5 h-5" /> : <IconMenu2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="sm:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer - slides from right on mobile */}
      <div 
        className={`
          fixed sm:relative right-0 sm:left-0 top-0 h-full z-50 sm:z-auto
          w-[85%] sm:w-80 flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          sm:translate-x-0
        `}
        style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
      >
        {/* Mobile sidebar header */}
        <div className="sm:hidden p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--foreground)' }}>Notes</h2>
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--foreground)' }}
          >
            <IconX className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Back Button */}
        <div className="hidden sm:block p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => router.push(`/trip/${tripId}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'transparent',
              color: 'var(--foreground)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <IconArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back to Trip</span>
          </button>
        </div>

        {/* Notes list */}
        <div className="h-[calc(100%-60px)] sm:h-auto overflow-y-auto">
          <NotesSidebar 
            tripId={tripId} 
            tripDays={tripDays}
            selectedNote={selectedNote} 
            onSelectNote={handleSelectNote} 
          />
        </div>
      </div>

      {/* Desktop sidebar border - on the left side */}
      <div className="hidden sm:block" style={{ borderRight: '1px solid var(--border)' }} />

      {/* Editor - Full screen on mobile */}
      <div className="flex-1 overflow-hidden pt-14 sm:pt-0">
        <NotesEditor 
          key={selectedNote || 'general'} 
          tripId={tripId} 
          noteSelection={selectedNote} 
        />
      </div>
    </div>
  );
}
