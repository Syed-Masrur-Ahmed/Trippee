import { createClient } from '@/lib/supabase/server';
import { createClient as createClientJS } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getInvitationEmailHTML, getInvitationEmailText } from '@/lib/email/templates';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  
  // Try cookie-based auth first (better for RLS), fallback to token-based
  let supabase = await createClient();
  let { data: { user } } = await supabase.auth.getUser();
  
  // If no user from cookies, try Authorization header
  if (!user) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      supabase = createClientJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: tokenUser } } = await supabase.auth.getUser();
      if (tokenUser) {
        user = tokenUser;
      }
    }
  }

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
    .select('id, name, created_by')
    .eq('id', tripId)
    .single();

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const tripData = trip as { id: string; name: string; created_by: string };

  // Check if user is trip owner
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const invitationData = invitation as { token: string };
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteLink = `${baseUrl}/invite/${invitationData.token}`;

  // Get inviter's name for email
  const { data: inviterProfileData } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const inviterProfile = inviterProfileData as { full_name: string | null; email: string | null } | null;
  const inviterName = inviterProfile?.full_name || inviterProfile?.email?.split('@')[0] || 'Someone';

  // Send email invitation
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'Trippee <onboarding@resend.dev>',
        to: email,
        subject: `You've been invited to collaborate on ${tripData.name}`,
        html: getInvitationEmailHTML(tripData.name, inviterName, inviteLink),
        text: getInvitationEmailText(tripData.name, inviterName, inviteLink),
      });
    }
  } catch {
    // Email send failed - continue anyway, user can copy invite link manually
  }

  return NextResponse.json({
    invitation,
    inviteLink,
    emailSent: !!process.env.RESEND_API_KEY,
  });
}

