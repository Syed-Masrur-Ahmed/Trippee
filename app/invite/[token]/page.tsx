'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  useEffect(() => {
    if (token) {
      loadInvitation();
    }
  }, [token]);

  async function loadInvitation() {
    if (!token) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('trip_invitations')
      .select('*, trips(id, name)')
      .eq('token', token)
      .eq('status', 'pending')
      .single();

    if (error || !data) {
      setError('Invalid or expired invitation');
      setLoading(false);
      return;
    }

    // Check if invitation has expired
    const invitationData = data as any;
    if (invitationData.expires_at && new Date(invitationData.expires_at) < new Date()) {
      setError('This invitation has expired');
      setLoading(false);
      return;
    }

    setInvitation(data as Invitation);
    setLoading(false);
  }

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
        invited_by: invitation.invited_by,
      } as any);

    if (memberError) {
      setError(memberError.message);
      setAccepting(false);
      return;
    }

    // Update invitation status
    await supabase
      .from('trip_invitations')
      .update({ status: 'accepted' } as any)
      .eq('id', invitation.id);

    // Redirect to trip
    router.push(`/trip/${invitation.trip_id}`);
  }

  if (loading || authLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-700">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-xl text-gray-700">Loading invitation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">Trip Invitation</h1>
        <p className="text-gray-700 mb-2">
          You've been invited to collaborate on:
        </p>
        <p className="text-xl font-semibold text-blue-600 mb-6">
          {invitation.trips?.name || 'Unknown Trip'}
        </p>
        {!user && (
          <p className="text-sm text-gray-600 mb-4">
            Please sign in to accept this invitation.
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors font-semibold"
          >
            {accepting ? 'Accepting...' : user ? 'Accept Invitation' : 'Sign In to Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

