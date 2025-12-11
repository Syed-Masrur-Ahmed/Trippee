'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import NotesSidebar, { type NoteSelection } from './NotesSidebar';
import NotesEditor from './NotesEditor';
import { supabase } from '@/lib/supabase/client';

interface NotesLayoutProps {
  tripId: string;
}

export default function NotesLayout({ tripId }: NotesLayoutProps) {
  const [selectedNote, setSelectedNote] = useState<NoteSelection>(null);
  const [tripDays, setTripDays] = useState(3);
  const router = useRouter();

  // Load trip days
  useEffect(() => {
    async function loadTrip() {
      const { data } = await supabase
        .from('trips')
        .select('trip_days, start_date, end_date')
        .eq('id', tripId)
        .single();
      
      if (data) {
        const tripData = data as { trip_days?: number; start_date?: string | null; end_date?: string | null };
        if (tripData.trip_days) {
          setTripDays(tripData.trip_days);
        } else if (tripData.start_date && tripData.end_date) {
          const start = new Date(tripData.start_date);
          const end = new Date(tripData.end_date);
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          setTripDays(days);
        }
      }
    }
    loadTrip();
  }, [tripId]);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0" style={{ borderRight: '1px solid var(--border)', backgroundColor: 'var(--card)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
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
        <NotesSidebar 
          tripId={tripId} 
          tripDays={tripDays}
          selectedNote={selectedNote} 
          onSelectNote={setSelectedNote} 
        />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <NotesEditor 
          key={selectedNote || 'general'} 
          tripId={tripId} 
          noteSelection={selectedNote} 
        />
      </div>
    </div>
  );
}

