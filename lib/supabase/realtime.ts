import { supabase } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Place } from './schema.types';

export type RealtimeEvent =
  | { type: 'place_added'; place: Place }
  | { type: 'place_updated'; id: string; updates: Partial<Place> }
  | { type: 'place_deleted'; id: string }
  | { type: 'cursor_move'; user_id: string; user_name?: string; lat: number; lng: number; color: string };

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