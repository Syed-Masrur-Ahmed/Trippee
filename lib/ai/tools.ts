import { tool } from 'ai';
import { z } from 'zod';

const searchPlacesSchema = z.object({
  query: z.string().describe('Search query that can include location names and categories. Examples: "cafes in Shibuya", "sushi restaurants Tokyo", "museums near Ueno", "temples Kyoto". You can combine location and category in the query.'),
  lat: z.number().optional().describe('Latitude of search center (optional, use trip center if not provided)'),
  lng: z.number().optional().describe('Longitude of search center (optional, use trip center if not provided)'),
  limit: z.number().default(3).describe('Max results to return (recommended: 3-5 for best results)'),
});

export const searchPlacesTool = tool({
  description: 'Search for places using Google Places API (New). The query parameter can include both location names (e.g., "Shibuya", "Tokyo") and categories (e.g., "cafes", "restaurants", "museums"). You can combine them like "cafes in Shibuya" or "sushi restaurants Tokyo". This is Google\'s latest Places API and provides excellent results for category-based searches with up-to-date data.',
  parameters: searchPlacesSchema,
  execute: async (params: z.output<typeof searchPlacesSchema>) => {
    // Ensure all parameters have defaults
    const query = params.query;
    const lat = params.lat ?? 0;
    const lng = params.lng ?? 0;
    const limit = params.limit ?? 3; // Default to 3 if not provided
    
    // Use absolute URL for server-side execution
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/places/search?q=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&limit=${limit}`;
    console.log('Tool executing search:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Search API error:', response.status, response.statusText);
      return { results: [] };
    }
    
    const data = await response.json();
    console.log('Tool search result count:', data.results?.length || 0);
    return data;
  },
} as any);