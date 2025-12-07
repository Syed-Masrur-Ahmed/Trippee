import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const getPlaceInfoSchema = z.object({
  placeName: z.string().optional().describe('Name of the place to get information about. Can be a place name from the itinerary or a general place name.'),
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
      
      console.log(`[Tool] Search API returned ${allResults.length} results for query: "${query}"`);
      
      // Filter duplicates server-side
      let nonDuplicateResults = allResults;
      if (tripId) {
        try {
          const supabase = await createClient();
          const { data: existingPlaces } = await supabase
            .from('places')
            .select('name, lat, lng, place_id')
            .eq('trip_id', tripId);
          
          if (existingPlaces && existingPlaces.length > 0) {
            console.log(`[Tool] Checking ${allResults.length} results against ${existingPlaces.length} existing places`);
            nonDuplicateResults = allResults.filter((place: any) => {
              if (!place || !place.name) return true;
              
              const placeName = place.name.toLowerCase().trim();
              const placeLat = place.lat;
              const placeLng = place.lng;
              const placeId = place.id;
              
              return !existingPlaces.some((existing) => {
                // Check by place_id (most reliable)
                if (placeId && existing.place_id && placeId === existing.place_id) {
                  return true;
                }
                // Check by exact name and coordinates (with small tolerance for floating point)
                const existingName = (existing.name || '').toLowerCase().trim();
                if (existingName === placeName) {
                  const latDiff = Math.abs(existing.lat - placeLat);
                  const lngDiff = Math.abs(existing.lng - placeLng);
                  // Very small threshold (about 1 meter)
                  if (latDiff < 0.00001 && lngDiff < 0.00001) {
                    return true;
                  }
                }
                return false;
              });
            });
            
            console.log(`[Tool] Filtered ${allResults.length - nonDuplicateResults.length} duplicate(s). ${nonDuplicateResults.length} remaining.`);
            console.log(`[Tool] Non-duplicate results:`, nonDuplicateResults.map((p: any) => p.name));
          }
        } catch (error) {
          console.error('[Tool] Error filtering duplicates:', error);
        }
      }
      
      // Return format: AI sees success message, client gets allResults in results field
      const placesAdded = nonDuplicateResults.slice(0, requestedLimit).length;
      
      console.log(`[Tool] Returning: placesAdded=${placesAdded}, allResults.length=${allResults.length}, nonDuplicateResults.length=${nonDuplicateResults.length}, requestedLimit=${requestedLimit}`);
      
      // Return allResults in the results field so client can access them
      // The AI will see the success message, but results array is for client processing
      const returnValue = {
        success: true,
        placesAdded,
        message: `Successfully found ${placesAdded} non-duplicate place(s) and added them to the itinerary.`,
        // Put allResults in results field so client can access it
        results: allResults,
        allResults: allResults, // Also include for backwards compatibility
        requestedLimit,
      };
      
      console.log(`[Tool] Return value structure:`, JSON.stringify(returnValue, null, 2));
      return returnValue;
    },
  } as any);
}

export function createGetPlaceInfoTool(tripId: string) {
  return tool({
    description: 'Get detailed information about a specific place. Use this when users ask about a place that is already in their itinerary, or when they want to know more about a specific place (e.g., "Tell me about Awakening Cafe", "What is Fuglen Tokyo?", "Give me info about the first place on Day 1"). You can search by place name or use the place ID if available.',
    parameters: getPlaceInfoSchema,
    execute: async (params: z.output<typeof getPlaceInfoSchema>) => {
      const { placeName, placeId, tripPlaceId } = params;
      
      // First, try to find the place in the trip's places
      let tripPlace = null;
      let googlePlaceId = placeId;
      
      if (tripPlaceId) {
        // Get place from trip database
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
            googlePlaceId = data.place_id || googlePlaceId;
          }
        } catch (error) {
          console.error('[Tool] Error fetching trip place:', error);
        }
      } else if (placeName) {
        // Search for place in trip by name
        try {
          const supabase = await createClient();
          const { data } = await supabase
            .from('places')
            .select('*')
            .eq('trip_id', tripId)
            .ilike('name', `%${placeName}%`)
            .limit(1)
            .single();
          
          if (data) {
            tripPlace = data;
            googlePlaceId = data.place_id || googlePlaceId;
          }
        } catch (error) {
          console.error('[Tool] Error searching trip places:', error);
        }
      }
      
      // If we don't have a Google Place ID yet but have a place name, search for it
      if (!googlePlaceId && placeName) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const searchUrl = `${baseUrl}/api/places/search?q=${encodeURIComponent(placeName)}&limit=1`;
          
          const searchResponse = await fetch(searchUrl);
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.results && searchData.results.length > 0) {
              // Use the first result's ID
              googlePlaceId = searchData.results[0].id;
              console.log(`[Tool] Found place via search: ${searchData.results[0].name} (ID: ${googlePlaceId})`);
            }
          }
        } catch (error) {
          console.error('[Tool] Error searching for place:', error);
        }
      }
      
      // If we have a Google Place ID, fetch detailed info from Google Places API
      let googlePlaceDetails = null;
      if (googlePlaceId) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const url = `${baseUrl}/api/places/details?placeId=${encodeURIComponent(googlePlaceId)}`;
          
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            googlePlaceDetails = data;
          }
        } catch (error) {
          console.error('[Tool] Error fetching Google Place details:', error);
        }
      }
      
      // If we still don't have any information, return an error
      if (!tripPlace && !googlePlaceDetails) {
        return {
          error: `I couldn't find information about "${placeName}". The place might not exist in your itinerary or in Google Places. Try searching for it first using the search_places tool, or check the spelling.`,
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