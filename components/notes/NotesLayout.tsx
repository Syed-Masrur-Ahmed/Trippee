'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft } from '@tabler/icons-react';
import NotesSidebar from './NotesSidebar';
import NotesEditor from './NotesEditor';

interface NotesLayoutProps {
  tripId: string;
}

export default function NotesLayout({ tripId }: NotesLayoutProps) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const router = useRouter();

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
        <NotesSidebar tripId={tripId} selectedPlaceId={selectedPlaceId} onSelectPlace={setSelectedPlaceId} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <NotesEditor key={selectedPlaceId || 'general'} tripId={tripId} placeId={selectedPlaceId} />
      </div>
    </div>
  );
}

