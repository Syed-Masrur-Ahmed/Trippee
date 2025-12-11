'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import AuthModal from '@/components/auth/AuthModal';

// Hook to safely detect client-side mounting
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [tripName, setTripName] = useState<string | null>(null);
  const mounted = useIsMounted();
  
  // Show Dashboard link on trip pages, but not on dashboard page
  const showDashboardLink = pathname?.startsWith('/trip/') && pathname !== '/dashboard';
  const isTripPage = pathname?.startsWith('/trip/');
  
  // Extract tripId from pathname
  const tripId = isTripPage ? pathname.split('/trip/')[1]?.split('/')[0] : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  function getUserInitials() {
    if (!user) return '?';
    const email = user.email || '';
    const name = user.user_metadata?.full_name || email;
    if (name.includes(' ')) {
      return name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return name[0].toUpperCase();
  }

  const loadUserProfile = useCallback(async () => {
    if (!user) {
      setUserFullName(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) {
        setUserFullName(user.user_metadata?.full_name || user.email || null);
      } else {
        const profileData = data as { full_name?: string } | null;
        setUserFullName(profileData?.full_name || user.user_metadata?.full_name || user.email || null);
      }
    } catch {
      setUserFullName(user.user_metadata?.full_name || user.email || null);
    }
  }, [user]);

  const loadTripName = useCallback(async () => {
    if (!tripId || !user) {
      setTripName(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('trips')
        .select('name')
        .eq('id', tripId)
        .single();

      if (error) {
        setTripName(null);
      } else {
        const tripData = data as { name?: string } | null;
        setTripName(tripData?.name || null);
      }
    } catch {
      setTripName(null);
    }
  }, [tripId, user]);

  useEffect(() => {
    if (mounted && user) {
      loadUserProfile();
    }
  }, [user, mounted, loadUserProfile]);

  // Load trip name when on trip page
  useEffect(() => {
    if (mounted && isTripPage && tripId) {
      loadTripName();
    } else if (!isTripPage || !tripId) {
      setTripName(null);
    }
  }, [mounted, isTripPage, tripId, loadTripName]);

  return (
    <>
      <header className="sticky top-0 z-50" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'var(--primary)' }}>
        <div className="max-w-7xl mx-auto px-2 py-2 sm:px-4 sm:py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <Link href="/" className="text-2xl sm:text-4xl font-bold trippee-font flex-shrink-0" style={{ color: 'var(--primary-foreground)' }}>
              Trippee
            </Link>
            {tripName && (
              <>
                <span className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                <span className="text-sm sm:text-lg font-medium truncate max-w-[120px] sm:max-w-none" style={{ color: 'var(--primary-foreground)' }}>
                  {tripName}
                </span>
              </>
            )}
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {!mounted || loading ? (
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--primary-foreground)' }}></div>
            ) : user ? (
              <>
                {/* User name - hidden on mobile */}
                {userFullName && (
                  <span className="hidden md:inline font-medium" style={{ color: 'var(--primary-foreground)' }}>
                    {userFullName}
                  </span>
                )}
                {/* Dashboard link - hidden on mobile */}
                {showDashboardLink && (
                  <Link
                    href="/dashboard"
                    className="hidden sm:inline transition-colors"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-foreground)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                  >
                    Dashboard
                  </Link>
                )}
                {/* Sign out - text hidden on mobile, show icon */}
                <button
                  onClick={handleSignOut}
                  className="transition-colors flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-foreground)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                  title="Sign Out"
                >
                  <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm" style={{ backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' }}>
                  {getUserInitials()}
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded transition-colors text-sm sm:text-base"
                style={{ backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}

