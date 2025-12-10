'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userFullName, setUserFullName] = useState<string | null>(null);
  const [tripName, setTripName] = useState<string | null>(null);
  
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

  // Ensure consistent initial render to avoid hydration mismatch
  // Show loading state initially, then update after hydration
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function loadUserProfile() {
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
          setUserFullName((data as any)?.full_name || user.user_metadata?.full_name || user.email || null);
        }
      } catch {
        setUserFullName(user.user_metadata?.full_name || user.email || null);
      }
    }

    if (mounted && user) {
      loadUserProfile();
    }
  }, [user, mounted]);

  // Load trip name when on trip page
  useEffect(() => {
    async function loadTripName() {
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
          setTripName((data as any)?.name || null);
        }
      } catch {
        setTripName(null);
      }
    }

    if (mounted && isTripPage && tripId) {
      loadTripName();
    } else {
      setTripName(null);
    }
  }, [mounted, isTripPage, tripId, user]);

  return (
    <>
      <header className="sticky top-0 z-50" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'var(--primary)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-4xl font-bold trippee-font" style={{ color: 'var(--primary-foreground)' }}>
              Trippee
            </Link>
            {tripName && (
              <>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>•</span>
                <span className="text-lg font-medium" style={{ color: 'var(--primary-foreground)' }}>
                  {tripName}
                </span>
              </>
            )}
          </div>
          <nav className="flex items-center gap-4">
            {!mounted || loading ? (
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--primary-foreground)' }}></div>
            ) : user ? (
              <>
                {userFullName && (
                  <span className="font-medium" style={{ color: 'var(--primary-foreground)' }}>
                    {userFullName}
                  </span>
                )}
                {showDashboardLink && (
                  <Link
                    href="/dashboard"
                    className="transition-colors"
                    style={{ color: 'rgba(255,255,255,0.8)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-foreground)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                  >
                    Dashboard
                  </Link>
                )}
                <button
                  onClick={handleSignOut}
                  className="transition-colors"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-foreground)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                >
                  Sign Out
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style={{ backgroundColor: 'var(--primary-foreground)', color: 'var(--primary)' }}>
                  {getUserInitials()}
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded transition-colors"
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

