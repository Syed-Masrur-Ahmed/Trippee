'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuthContext } from '@/components/auth/AuthProvider';
import Link from 'next/link';

interface Invitation {
  id: string;
  trip_id: string;
  email: string;
  invited_by: string;
  token: string;
  status: string;
  expires_at: string;
  trips: {
    id: string;
    name: string;
  };
}

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const loadInvitation = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('trip_invitations')
      .select('*, trips(id, name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (fetchError || !data) {
      setError('Invalid or expired invitation');
      setLoading(false);
      return;
    }

    // Check if invitation has expired
    const invitationData = data as Invitation;
    if (invitationData.expires_at && new Date(invitationData.expires_at) < new Date()) {
      setError('This invitation has expired');
      setLoading(false);
      return;
    }

    setInvitation(invitationData);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (token) {
      loadInvitation().catch(() => {
        // Silently handle any errors
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAccept() {
    if (!user || !invitation) {
      // Redirect to sign in, then back to invite
      router.push(`/?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', invitation.trip_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember) {
      // Already a member, just redirect
      router.push(`/trip/${invitation.trip_id}`);
      return;
    }

    // Add user to trip_members
    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: invitation.trip_id,
        user_id: user.id,
        role: 'member',
      });

    if (memberError) {
      setError(memberError.message);
      setAccepting(false);
      return;
    }

    // Update invitation status
    await supabase
      .from('trip_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    // Redirect to trip
    router.push(`/trip/${invitation.trip_id}`);
  }

  if (loading || authLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-xl" style={{ color: 'var(--foreground)' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
        <div className="rounded-lg p-8 max-w-md w-full text-center" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}>
          <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--destructive)' }}>Invalid Invitation</h1>
          <p className="mb-6" style={{ color: 'var(--muted-foreground)' }}>{error}</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 rounded transition-colors"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-xl" style={{ color: 'var(--foreground)' }}>Loading invitation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--background)' }}>
      <div className="rounded-lg p-8 max-w-md w-full" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}>
        <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Trip Invitation</h1>
        <p className="mb-2" style={{ color: 'var(--muted-foreground)' }}>
          You&apos;ve been invited to collaborate on:
        </p>
        <p className="text-xl font-semibold mb-6" style={{ color: 'var(--primary)' }}>
          {invitation.trips?.name || 'Unknown Trip'}
        </p>
        {!user && (
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Please sign in to accept this invitation.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 py-2 rounded-lg transition-colors font-semibold"
            style={{
              backgroundColor: accepting ? 'var(--muted)' : 'var(--primary)',
              color: accepting ? 'var(--muted-foreground)' : 'var(--primary-foreground)'
            }}
          >
            {accepting ? 'Accepting...' : user ? 'Accept Invitation' : 'Sign In to Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

