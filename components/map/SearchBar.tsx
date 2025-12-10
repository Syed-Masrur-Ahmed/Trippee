'use client';

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

interface SearchBarProps {
  onSelectResult: (result: SearchResult) => void;
}

export default function SearchBar({ onSelectResult }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Debounce search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      await performSearch(query);
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  async function performSearch(searchQuery: string) {
    try {
      const response = await fetch(
        `/api/places/search?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      const data = await response.json();
      // Handle both error cases and ensure results array exists
      const results = data.results || [];
      setResults(results.slice(0, 5)); // Show max 5 in dropdown
      setIsOpen(true);
      setLoading(false);
    } catch {
      setLoading(false);
      setResults([]);
    }
  }

  function handleSelectResult(result: SearchResult) {
    onSelectResult(result);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for places..."
          className="w-full pl-10 pr-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition-all"
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--input)',
            color: 'var(--foreground)',
            boxShadow: 'var(--shadow-lg)',
            '--tw-ring-color': 'var(--ring)'
          } as React.CSSProperties}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 rounded-full animate-spin" style={{ border: '2px solid var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 rounded-lg max-h-80 overflow-y-auto" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                borderBottom: '1px solid var(--border)',
                color: 'var(--foreground)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div className="font-medium" style={{ color: 'var(--foreground)' }}>{result.name}</div>
              {result.address && (
                <div className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{result.address}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && !loading && query.length >= 3 && (
        <div className="absolute z-50 w-full mt-2 rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No results found</p>
        </div>
      )}
    </div>
  );
}

