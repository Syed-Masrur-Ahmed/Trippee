'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import AuthModal from '@/components/auth/AuthModal';
import Squares from '@/components/ui/Squares';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Redirect to dashboard if already logged in
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // Prevent scrolling on mobile for landing page
    const preventScroll = () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    };
    
    const allowScroll = () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };

    // Only prevent scroll on mobile
    if (window.innerWidth < 640) {
      preventScroll();
      return () => {
        allowScroll();
      };
    }
  }, []);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div 
        className="flex h-screen items-center justify-center relative overflow-hidden sm:min-h-screen sm:overflow-auto" 
        style={{ backgroundColor: 'var(--background)' }}
      >
        <Squares direction="diagonal" speed={0.2} squareSize={50} />
        <div className="max-w-md w-full px-6 relative z-10 flex flex-col items-center justify-between h-full py-8 sm:py-0 sm:h-auto sm:justify-center">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0">
            <div className="text-center mb-4 sm:mb-12">
              <h1 className="text-4xl sm:text-7xl font-bold mb-2 sm:mb-4 trippee-font" style={{ color: 'var(--foreground)' }}>Trippee</h1>
              <p className="text-sm sm:text-lg" style={{ color: 'var(--muted-foreground)' }}>AI-powered collaborative trip planning</p>
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-6 sm:px-8 py-3 sm:py-4 rounded-lg transition-colors font-semibold text-sm sm:text-lg"
                style={{ 
                  backgroundColor: 'var(--primary)', 
                  color: 'var(--primary-foreground)',
                  boxShadow: 'var(--shadow-lg)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Start Planning Your Trip Now
              </button>
            </div>
          </div>
          
          {/* Made by text - part of flex on mobile, absolute on desktop */}
          <div className="text-xs mt-auto sm:hidden" style={{ color: 'var(--muted-foreground)' }}>
            Made by{' '}
            <Link
              href="https://github.com/Syed-Masrur-Ahmed"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors underline"
              style={{ color: 'var(--primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              Syed Masrur Ahmed
            </Link>
          </div>
        </div>
        {/* Made by text - desktop only, absolutely positioned */}
        <div className="hidden sm:block absolute bottom-4 right-4 text-xs z-10" style={{ color: 'var(--muted-foreground)' }}>
          Made by{' '}
          <Link
            href="https://github.com/Syed-Masrur-Ahmed"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors underline"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Syed Masrur Ahmed
          </Link>
        </div>
      </div>
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}
