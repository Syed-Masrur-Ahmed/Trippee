'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

interface TripMembersModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Trip {
  id: string;
  name: string;
  created_by: string;
  original_created_by?: string | null;
}

export default function TripMembersModal({
  tripId,
  isOpen,
  onClose,
}: TripMembersModalProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, tripId]);

  async function loadMembers() {
    setLoading(true);
    try {
      // Get trip info to find host
      const { data: tripData } = await supabase
        .from('trips')
        .select('id, name, created_by, original_created_by, created_at')
        .eq('id', tripId)
        .single();

      if (tripData) {
        setTrip(tripData as Trip);
      }

      // Get all members
      const { data: membersData, error } = await supabase
        .from('trip_members')
        .select('user_id, role, joined_at')
        .eq('trip_id', tripId)
        .order('joined_at', { ascending: true });

      if (error) {
        setLoading(false);
        return;
      }

      // Get profiles for all members
      const userIds = membersData?.map((m) => m.user_id) || [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        const profilesMap = new Map(
          (profilesData || []).map((p: any) => [p.id, p])
        );

        const membersWithProfiles: Member[] = (membersData || []).map((m: any) => ({
          ...m,
          profile: profilesMap.get(m.user_id) || null,
        }));

        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch {
      // Error loading members - fail silently
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const hostId = trip?.created_by;
  const originalCreatorId = trip?.original_created_by || trip?.created_by;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-lg w-full max-w-md p-6" style={{ backgroundColor: 'var(--card)', boxShadow: 'var(--shadow-xl)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Trip Members</h2>
          <button
            onClick={onClose}
            className="transition-colors"
            style={{ color: 'var(--muted-foreground)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--foreground)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--muted-foreground)'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '2px solid var(--border)', borderTopColor: 'var(--primary)' }}></div>
          </div>
        ) : (
          <div className="space-y-3">
            {members.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No members found.</p>
            ) : (
              members.map((member) => {
                const isHost = member.user_id === hostId;
                const isOriginalCreator = member.user_id === originalCreatorId;
                const displayName = member.profile?.full_name || member.profile?.email || 'Unknown User';

                return (
                  <div
                    key={member.user_id}
                    className="rounded-lg p-3 flex items-center justify-between"
                    style={{
                      backgroundColor: isHost ? 'var(--accent)' : 'var(--background)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm"
                        style={{
                          backgroundColor: isHost ? 'var(--primary)' : 'var(--muted)',
                          color: isHost ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        }}
                      >
                        {displayName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                          {displayName}
                        </p>
                        {isHost && (
                          <p className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                            Host
                          </p>
                        )}
                        {isOriginalCreator && !isHost && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            Creator
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

