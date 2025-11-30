import { supabase } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEvent =
  | { type: 'place_added'; place: any }
  | { type: 'place_updated'; id: string; updates: any }
  | { type: 'place_deleted'; id: string }
  | { type: 'cursor_move'; user_id: string; lat: number; lng: number; color: string };

export function subscribeToTrip(
  tripId: string,
  onEvent: (event: RealtimeEvent) => void
): RealtimeChannel {
  const channel = supabase.channel(`trip:${tripId}`);

  channel
    .on('broadcast', { event: 'place_event' }, ({ payload }) => {
      onEvent(payload as RealtimeEvent);
    })
    .subscribe();

  return channel;
}

export function broadcastEvent(channel: RealtimeChannel, event: RealtimeEvent) {
  channel.send({
    type: 'broadcast',
    event: 'place_event',
    payload: event,
  });
}