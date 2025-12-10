import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const getPlaceInfoSchema = z.object({
  placeName: z.string().optional().describe('REQUIRED when user mentions a place name. Extract the exact place name from the user\'s message. Examples: If user says "tell me about Tasty Treat Dhanmondi", use placeName="Tasty Treat Dhanmondi". If user says "what is Awakening Cafe", use placeName="Awakening Cafe". Include the full name including location if mentioned (e.g., "Tasty Treat Dhanmondi" not just "Tasty Treat").'),
  placeId: z.string().optional().describe('Google Places ID of the place (if available).'),
  tripPlaceId: z.string().optional().describe('ID of the place in the trip database (if asking about a place already in the itinerary).'),
});

const searchPlacesSchema = z.object({
  query: z.string().describe('Search query that can include location names and categories. Examples: "cafes in Shibuya", "sushi restaurants Tokyo", "museums near Ueno", "temples Kyoto". You can combine location and category in the query.'),
    lat: z.number().optional().describe('Latitude of search center (optional, use trip center if not provided)'),
    lng: z.number().optional().describe('Longitude of search center (optional, use trip center if not provided)'),
  limit: z.number().default(1).describe('Number of results to return. IMPORTANT: Extract the number from the user\'s request. If user says "find me a cafe" or "find me one cafe", use limit=1. If user says "find me 5 cafes", use limit=5. If user says "find me cafes" (no number), use limit=3 as a reasonable default. Always match the user\'s intent for quantity.'),
});

export function createSearchPlacesTool(tripId: string) {
  return tool({
    description: 'Search for places using Google Places API (New). The query parameter can include both location names (e.g., "Shibuya", "Tokyo") and categories (e.g., "cafes", "restaurants", "museums"). You can combine them like "cafes in Shibuya" or "sushi restaurants Tokyo". IMPORTANT: Pay attention to the limit parameter - extract the number from the user\'s request. If they say "find me a cafe" or "one cafe", use limit=1. If they say "find me 5 cafes", use limit=5. If no number is specified, use limit=3 as a default. This tool automatically filters out duplicate places that are already on the map.',
    parameters: searchPlacesSchema,
    execute: async (params: z.output<typeof searchPlacesSchema>) => {
      const query = params.query;
      const lat = params.lat ?? 0;
      const lng = params.lng ?? 0;
      const requestedLimit = params.limit ?? 1;
      const searchLimit = requestedLimit === 1 ? 5 : Math.max(requestedLimit + 3, 5);
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const url = `${baseUrl}/api/places/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&limit=${searchLimit}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        return { results: [] };
      }
      
      const data = await response.json();
      const allResults = data.results || [];
      
      // Filter duplicates server-side
      let nonDuplicateResults = allResults;
      if (tripId && allResults.length > 0) {
        try {
          const supabase = await createClient();
          const { data: existingPlaces } = await supabase
            .from('places')
            .select('name, lat, lng, place_id')
            .eq('trip_id', tripId);
          
          if (existingPlaces && Array.isArray(existingPlaces) && existingPlaces.length > 0) {
            nonDuplicateResults = allResults.filter((place: any) => {
              if (!place?.name) return true;
              
              const placeName = place.name.toLowerCase().trim();
              return !existingPlaces.some((existing: any) => {
                if (place.id && existing.place_id && place.id === existing.place_id) return true;
                const existingName = (existing.name || '').toLowerCase().trim();
                if (existingName === placeName) {
                  return Math.abs(existing.lat - place.lat) < 0.00001 && 
                         Math.abs(existing.lng - place.lng) < 0.00001;
                }
                return false;
              });
            });
          }
        } catch {
          // Continue without duplicate filtering
        }
      }
      
      const placesAdded = Math.min(nonDuplicateResults.length, requestedLimit);
      
      return {
        success: true,
        placesAdded,
        message: `Successfully found ${placesAdded} non-duplicate place(s) and added them to the itinerary.`,
        results: allResults,
        requestedLimit,
      };
    },
  } as any);
}

export function createGetPlaceInfoTool(tripId: string) {
  return tool({
    description: 'Get detailed information about a specific place. Use this when users ask about a place by name, such as "Tell me about [place name]", "Tell me more about [place name]", "What is [place name]?", or "Give me info about [place name]". This tool works for places both in and outside the itinerary. Examples: "Tell me about Awakening Cafe", "Tell me more about Tasty Treat Dhanmondi", "What is Fuglen Tokyo?", "Give me info about the first place on Day 1". IMPORTANT: When calling this tool, you MUST extract the exact place name from the user\'s message and pass it as the placeName parameter. For example, if the user says "tell me more about Tasty Treat Dhanmondi", you must call this tool with placeName="Tasty Treat Dhanmondi" (include the full name including location if mentioned). Do NOT use search_places for this - use get_place_info instead.',
    parameters: getPlaceInfoSchema,
    execute: async (params: z.output<typeof getPlaceInfoSchema>) => {
      const { placeName, placeId, tripPlaceId } = params;
      
      // Validate that we have at least one identifier
      if (!placeName && !placeId && !tripPlaceId) {
        return {
          error: 'Please provide a place name, place ID, or trip place ID to get information about a place.',
        };
      }
      
      let tripPlace: any = null;
      let googlePlaceId = placeId;
      
      // If tripPlaceId is provided, get from database first
      if (tripPlaceId) {
        try {
          const supabase = await createClient();
          const { data, error } = await supabase
            .from('places')
            .select('*')
            .eq('id', tripPlaceId)
            .eq('trip_id', tripId)
            .single();
          
          if (!error && data) {
            tripPlace = data;
            googlePlaceId = (data as any)?.place_id || googlePlaceId;
          }
        } catch {
          // Continue without trip place data
        }
      }
      
      // If we have a place name but no Google Place ID yet, search Google Places first
      // This matches the search bar behavior - use the first result from Google Places
      if (!googlePlaceId && placeName) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const searchResponse = await fetch(`${baseUrl}/api/places/search?q=${encodeURIComponent(placeName)}&limit=1`);
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.results && Array.isArray(searchData.results) && searchData.results.length > 0) {
              googlePlaceId = searchData.results[0].id;
            }
          }
        } catch {
          // Continue without search results
        }
      }
      
      // Now check if this place is in the trip database (to get trip-specific info)
      if (googlePlaceId && !tripPlace) {
        try {
          const supabase = await createClient();
          const { data } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .eq('place_id', googlePlaceId)
            .maybeSingle();
          
          if (data) {
            tripPlace = data;
          }
        } catch {
          // Continue without trip place check
        }
      }
      
      // Fetch detailed info from Google Places API if we have a Place ID
      let googlePlaceDetails = null;
      if (googlePlaceId) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const response = await fetch(`${baseUrl}/api/places/details?placeId=${encodeURIComponent(googlePlaceId)}`);
          if (response.ok) {
            googlePlaceDetails = await response.json();
          }
        } catch {
          // Continue without Google Place details
        }
      }
      
      // If we still don't have any information, return an error
      if (!tripPlace && !googlePlaceDetails) {
        const placeNameForError = placeName || 'this place';
        return {
          error: `I couldn't find information about "${placeNameForError}". The place might not exist in Google Places. Try checking the spelling or searching for it using the search bar.`,
        };
      }
      
      // Combine trip place info with Google details
      const result: any = {
        name: tripPlace?.name || googlePlaceDetails?.name || placeName || 'Unknown Place',
        address: tripPlace?.address || googlePlaceDetails?.formattedAddress || 'Address not available',
        category: tripPlace?.category || googlePlaceDetails?.category || 'other',
        coordinates: tripPlace ? { lat: tripPlace.lat, lng: tripPlace.lng } : (googlePlaceDetails?.location ? { lat: googlePlaceDetails.location.latitude, lng: googlePlaceDetails.location.longitude } : null),
        dayAssigned: tripPlace?.day_assigned || null,
        notes: tripPlace?.notes || null,
      };
      
      // Add Google Places details if available
      if (googlePlaceDetails) {
        result.rating = googlePlaceDetails.rating || null;
        result.userRatingCount = googlePlaceDetails.userRatingCount || null;
        result.phoneNumber = googlePlaceDetails.phoneNumber || null;
        result.website = googlePlaceDetails.website || null;
        result.openingHours = googlePlaceDetails.openingHours || null;
        result.priceLevel = googlePlaceDetails.priceLevel || null;
        result.types = googlePlaceDetails.types || null;
        result.photos = googlePlaceDetails.photos || null;
        result.reviews = googlePlaceDetails.reviews || null;
      }
      
      return result;
    },
  } as any);
}