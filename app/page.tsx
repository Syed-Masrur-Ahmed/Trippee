'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import AuthModal from '@/components/auth/AuthModal';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tripName, setTripName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    if (!tripName.trim()) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    const { data, error } = await createTrip({
      name: tripName,
      trip_days: 3,
      created_by: user.id,
    });

    if (data) {
      router.push(`/trip/${data.id}`);
    } else {
      console.error('Failed to create trip:', error);
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md w-full px-6">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Trippee</h1>
            <p className="text-gray-600">AI-powered collaborative trip planning</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Create a New Trip</h2>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <div>
                <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-2">
                  Trip Name
                </label>
                <input
                  id="tripName"
                  type="text"
                  value={tripName}
                  onChange={(e) => setTripName(e.target.value)}
                  placeholder="e.g., Tokyo 2026"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !tripName.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
            </form>
            {!user && (
              <p className="mt-4 text-center text-sm text-gray-700">
                You'll need to sign in to create a trip
              </p>
            )}
          </div>
        </div>
      </div>
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}
