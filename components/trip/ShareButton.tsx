'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

interface ShareButtonProps {
  tripId: string;
  isOwner: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showButton?: boolean;
}

export default function ShareButton({ tripId, isOwner, open, onOpenChange, showButton = true }: ShareButtonProps) {
  const [internalShowModal, setInternalShowModal] = useState(false);
  const lastOpenRef = useRef<boolean | undefined>(undefined);
  
  // Sync internal state with controlled prop (avoiding useEffect setState)
  if (open !== undefined && open !== lastOpenRef.current) {
    lastOpenRef.current = open;
    setInternalShowModal(open);
  }
  
  const showModal = open !== undefined ? open : internalShowModal;
  const setShowModal = onOpenChange || setInternalShowModal;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Get session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be signed in to invite others');
      setLoading(false);
      return;
    }

    const response = await fetch(`/api/trips/${tripId}/invite`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      setSuccess(true);
      setInviteLink(data.inviteLink);
      setEmail('');
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
        setInviteLink(null);
      }, 3000);
    } else {
      setError(data.error || 'Failed to send invitation');
    }

    setLoading(false);
  }

  function copyInviteLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      alert('Invitation link copied to clipboard!');
    }
  }

  // Only owners can invite - render nothing if not owner
  if (!isOwner) {
    return null;
  }

  return (
    <>
      {showButton && (
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          Share Trip
        </button>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="p-6 rounded-lg w-96 max-w-[90vw]" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>Invite Collaborator</h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEmail('');
                  setError(null);
                  setSuccess(false);
                  setInviteLink(null);
                }}
                className="transition-colors"
                style={{ color: 'var(--muted-foreground)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                disabled={loading}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg px-4 py-2 focus:outline-none focus:ring-2 transition-all"
                  style={{
                    border: '1px solid var(--input)',
                    backgroundColor: 'var(--background)',
                    color: 'var(--foreground)',
                    '--tw-ring-color': 'var(--ring)'
                  } as React.CSSProperties}
                  required
                  disabled={loading}
                />
              </div>
              {success && (
                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Invitation sent!</p>
                  {inviteLink && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 text-xs rounded px-2 py-1"
                        style={{
                          border: '1px solid var(--border)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={copyInviteLink}
                        className="px-2 py-1 text-xs rounded transition-colors"
                        style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--accent)', border: '1px solid var(--destructive)' }}>
                  <p className="text-sm font-medium" style={{ color: 'var(--destructive)' }}>{error}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEmail('');
                    setError(null);
                    setSuccess(false);
                    setInviteLink(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="flex-1 px-4 py-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: loading || !email.trim() ? 'var(--muted)' : 'var(--primary)',
                    color: loading || !email.trim() ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
                  }}
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

