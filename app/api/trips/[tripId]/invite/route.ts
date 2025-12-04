import { createClient } from '@/lib/supabase/server';
import { createClient as createClientJS } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  
  // Dual authentication: try token-based first, fallback to cookie-based
  let supabase;
  let user;

  const authHeader = request.headers.get('Authorization');
  
  if (authHeader) {
    // Token-based authentication
    supabase = createClientJS(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
  } else {
    // Cookie-based authentication
    supabase = await createClient();
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  user = authUser;

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Verify user is trip owner or member with permission
  const { data: trip } = await supabase
    .from('trips')
    .select('id, created_by')
    .eq('id', tripId)
    .single();

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  // Check if user is trip owner
  const tripData = trip as { id: string; created_by: string };
  const isOwner = tripData.created_by === user.id;
  
  // Check if user is already a member
  const { data: member } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', user.id)
    .single();

  if (!isOwner && !member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if user with this email already exists
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  // Check if user is already a member
  if (existingUser) {
    const userData = existingUser as { id: string };
    const { data: existingMember } = await supabase
      .from('trip_members')
      .select('id')
      .eq('trip_id', tripId)
      .eq('user_id', userData.id)
      .single();

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this trip' }, { status: 400 });
    }
  }

  // Check if there's already a pending invitation for this email
  const { data: existingInvitation } = await supabase
    .from('trip_invitations')
    .select('id')
    .eq('trip_id', tripId)
    .eq('email', email)
    .eq('status', 'pending')
    .single();

  if (existingInvitation) {
    return NextResponse.json({ error: 'Invitation already sent to this email' }, { status: 400 });
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('trip_invitations')
    .insert({
      trip_id: tripId,
      email,
      invited_by: user.id,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: Send email with invitation link
  // For now, return invitation token
  const invitationData = invitation as { token: string };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return NextResponse.json({
    invitation,
    inviteLink: `${baseUrl}/invite/${invitationData.token}`,
  });
}

