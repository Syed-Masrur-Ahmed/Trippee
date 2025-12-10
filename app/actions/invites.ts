'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface PendingInvite {
  id: string;
  trip_id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
  invited_by: string;
  trip: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    created_by: string;
  };
  inviter: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

export async function getPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  console.log('getPendingInvites - user:', user?.id, user?.email);
  if (!user) {
    console.log('getPendingInvites - no user');
    return [];
  }

  // Get user's profile to match email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  console.log('getPendingInvites - profile:', profile, 'error:', profileError);

  if (!profile?.email) {
    console.log('getPendingInvites - no profile email');
    return [];
  }

  // Try fetching ALL invitations first (no filters) to see if RLS is blocking
  const { data: allInvitesNoFilter, error: allError } = await supabase
    .from('trip_invitations')
    .select('*');
  
  console.log('getPendingInvites - all invites (no filter):', allInvitesNoFilter?.length, 'error:', allError);

  // Fetch pending invitations for this email
  const { data: invitations, error } = await supabase
    .from('trip_invitations')
    .select('*')
    .eq('email', profile.email)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  console.log('getPendingInvites - filtered invites:', invitations?.length, 'error:', error);

  if (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }

  if (!invitations || invitations.length === 0) {
    // Debug: check if there are ANY invitations for this email (regardless of status/expiry)
    const { data: allInvites, error: allInvitesError } = await supabase
      .from('trip_invitations')
      .select('*')
      .eq('email', profile.email);
    
    console.log('getPendingInvites - invites for email:', profile.email, allInvites, 'error:', allInvitesError);
    return [];
  }

  // Fetch trip details separately to avoid RLS issues with joins
  const tripIds = [...new Set(invitations.map((inv: any) => inv.trip_id))];
  let tripMap = new Map();
  
  if (tripIds.length > 0) {
    const { data: trips } = await supabase
      .from('trips')
      .select('id, name, start_date, end_date, created_by')
      .in('id', tripIds);
    
    if (trips) {
      tripMap = new Map(trips.map((t: any) => [t.id, t]));
    }
  }

  // Get inviter profiles separately
  const inviterIds = [...new Set((invitations || []).map((inv: any) => inv.invited_by))];
  let inviterMap = new Map();
  
  if (inviterIds.length > 0) {
    const { data: inviters } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', inviterIds);
    
    if (inviters) {
      inviterMap = new Map(inviters.map((p: any) => [p.id, p]));
    }
  }

  // Transform the data to match our interface
  return (invitations || []).map((inv: any) => ({
    id: inv.id,
    trip_id: inv.trip_id,
    email: inv.email,
    status: inv.status,
    created_at: inv.created_at,
    expires_at: inv.expires_at,
    invited_by: inv.invited_by,
    trip: tripMap.get(inv.trip_id) || { id: inv.trip_id, name: 'Unknown Trip', start_date: null, end_date: null, created_by: '' },
    inviter: inviterMap.get(inv.invited_by) || null,
  })) as PendingInvite[];
}

export async function acceptInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Get the invitation
  const { data: invitation, error: inviteError } = await supabase
    .from('trip_invitations')
    .select('trip_id, email, expires_at')
    .eq('id', inviteId)
    .eq('status', 'pending')
    .single();

  if (inviteError || !invitation) {
    return { success: false, error: 'Invitation not found or already processed' };
  }

  // Verify the invitation is for this user's email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  if (!profile || profile.email !== invitation.email) {
    return { success: false, error: 'This invitation is not for you' };
  }

  // Check if invitation has expired
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { success: false, error: 'This invitation has expired' };
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('trip_members')
    .select('id')
    .eq('trip_id', invitation.trip_id)
    .eq('user_id', user.id)
    .single();

  if (existingMember) {
    // Already a member, just update the invitation status
    await supabase
      .from('trip_invitations')
      .update({ status: 'accepted' })
      .eq('id', inviteId);
    
    revalidatePath('/dashboard');
    return { success: true };
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
    return { success: false, error: memberError.message };
  }

  // Update invitation status
  const { error: updateError } = await supabase
    .from('trip_invitations')
    .update({ status: 'accepted' })
    .eq('id', inviteId);

  if (updateError) {
    // Member was added, but status update failed - not critical
    // Status update failure is non-critical since user is already added
  }

  revalidatePath('/dashboard');
  return { success: true };
}

export async function declineInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  // Verify the invitation is for this user's email
  const { data: invitation } = await supabase
    .from('trip_invitations')
    .select('email')
    .eq('id', inviteId)
    .single();

  if (!invitation) {
    return { success: false, error: 'Invitation not found' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  if (!profile || profile.email !== invitation.email) {
    return { success: false, error: 'This invitation is not for you' };
  }

  // Update invitation status
  const { error } = await supabase
    .from('trip_invitations')
    .update({ status: 'declined' })
    .eq('id', inviteId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/dashboard');
  return { success: true };
}

