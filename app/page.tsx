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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center relative" style={{ backgroundColor: 'var(--background)' }}>
        <Squares direction="diagonal" speed={0.2} squareSize={50} />
        <div className="max-w-md w-full px-6 relative z-10">
          <div className="text-center mb-12">
            <h1 className="text-7xl font-bold mb-4 trippee-font" style={{ color: 'var(--foreground)' }}>Trippee</h1>
            <p className="text-lg" style={{ color: 'var(--muted-foreground)' }}>AI-powered collaborative trip planning</p>
          </div>

          <div className="text-center">
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-8 py-4 rounded-lg transition-colors font-semibold text-lg"
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
        <div className="absolute bottom-4 right-4 text-xs" style={{ color: 'var(--muted-foreground)' }}>
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
