'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import AuthModal from '@/components/auth/AuthModal';

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userFullName, setUserFullName] = useState<string | null>(null);

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
          console.error('Error loading user profile:', error);
          // Fallback to user metadata or email
          setUserFullName(user.user_metadata?.full_name || user.email || null);
        } else {
          setUserFullName((data as any)?.full_name || user.user_metadata?.full_name || user.email || null);
        }
      } catch (err) {
        console.error('Error loading user profile:', err);
        setUserFullName(user.user_metadata?.full_name || user.email || null);
      }
    }

    if (mounted && user) {
      loadUserProfile();
    }
  }, [user, mounted]);

  return (
    <>
      <header className="sticky top-0 z-50" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-4xl font-bold trippee-font" style={{ color: 'var(--primary)' }}>
            Trippee
          </Link>
          <nav className="flex items-center gap-4">
            {!mounted || loading ? (
              <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--muted)', borderTopColor: 'var(--primary)' }}></div>
            ) : user ? (
              <>
                {userFullName && (
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {userFullName}
                  </span>
                )}
                <button
                  onClick={handleSignOut}
                  className="transition-colors"
                  style={{ color: 'var(--muted-foreground)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
                >
                  Sign Out
                </button>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                  {getUserInitials()}
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded transition-colors"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
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

