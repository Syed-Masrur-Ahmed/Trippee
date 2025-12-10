'use client';

import { useState, useEffect } from 'react';

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface PlaceModalProps {
  place: Place | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function PlaceModal({ place, isOpen, onClose, onSave, onDelete }: PlaceModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (place) {
      setName(place.name);
    }
  }, [place]);

  if (!isOpen || !place) return null;

  function handleSave() {
    if (name.trim() && place) {
      onSave(place.id, name.trim());
      onClose();
    }
  }

  function handleDelete() {
    if (place && confirm('Are you sure you want to delete this place?')) {
      onDelete(place.id);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-lg p-6 w-full max-w-md" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Edit Place</h2>
        
        <div className="mb-4">
          <label htmlFor="placeName" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
            Place Name
          </label>
          <input
            id="placeName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full px-4 py-2 rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              border: '1px solid var(--input)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
              '--tw-ring-color': 'var(--ring)'
            } as React.CSSProperties}
            autoFocus
          />
        </div>

        <div className="text-xs mb-6" style={{ color: 'var(--muted-foreground)' }}>
          Location: {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--muted)'}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{ backgroundColor: 'var(--destructive)', color: 'var(--destructive-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

