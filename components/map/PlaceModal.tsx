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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Edit Place</h2>
        
        <div className="mb-4">
          <label htmlFor="placeName" className="block text-sm font-medium text-gray-700 mb-2">
            Place Name
          </label>
          <input
            id="placeName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>

        <div className="text-xs text-gray-700 mb-6">
          Location: {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

