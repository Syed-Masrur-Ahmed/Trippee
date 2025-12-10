'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import NotesLayout from '@/components/notes/NotesLayout';

export default function NotesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }}></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return <NotesLayout tripId={tripId} />;
}

