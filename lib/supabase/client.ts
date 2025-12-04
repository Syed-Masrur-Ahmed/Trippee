import { createClient } from '@supabase/supabase-js';
import { Database } from './schema.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Client-side helpers
export async function getTrip(tripId: string) {
  return supabase.from('trips').select('*').eq('id', tripId).single();
}

export async function getPlaces(tripId: string) {
  return supabase
    .from('places')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });
}

export async function createPlace(place: Database['public']['Tables']['places']['Insert']) {
  return supabase.from('places').insert(place).select().single();
}

export async function updatePlace(
  id: string,
  updates: Database['public']['Tables']['places']['Update']
) {
  return supabase.from('places').update(updates).eq('id', id).select().single();
}

export async function deletePlace(id: string) {
  return supabase.from('places').delete().eq('id', id);
}

export async function createTrip(trip: Database['public']['Tables']['trips']['Insert']) {
  return supabase.from('trips').insert(trip).select().single();
}

export async function updateTrip(
  id: string,
  updates: Database['public']['Tables']['trips']['Update']
) {
  return supabase.from('trips').update(updates).eq('id', id).select().single();
}

