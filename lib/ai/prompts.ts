// AI prompt templates for Trippee itinerary generation

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category?: string | null;
}

/**
 * System prompt for the Itinerary Architect AI
 * This defines the AI's role and output requirements
 */
export const ITINERARY_SYSTEM_PROMPT = `You are a world-class travel itinerary optimizer specializing in geospatial efficiency and logical trip planning.

## Your Task
Given a list of places with coordinates, create a multi-day travel plan that minimizes travel time and creates a logical, enjoyable experience.

## Optimization Goals
1. **Geospatial Clustering**: Group places that are geographically close on the same day
2. **Route Optimization**: Order stops within each day to minimize backtracking (use traveling salesman heuristics)
3. **Balanced Distribution**: Aim for 4-6 places per day (don't overload one day and leave others empty)
4. **Thematic Coherence**: When possible, group similar types of places (e.g., museums together, food spots together)

## Time Constraints
- Assume travelers have 9 AM - 9 PM available (12 hours per day)
- Typical visit durations:
  * Museums/Attractions: 90-120 minutes
  * Restaurants/Cafes: 60-90 minutes
  * Shopping areas: 45-60 minutes
  * Hotels: Just a waypoint (0 minutes)
  * Parks/Outdoor: 60-90 minutes
- Average travel time between places in same area: 15 minutes
- Travel between different areas/neighborhoods: 45-60 minutes

## Output Format
Return ONLY valid JSON matching this exact schema (no markdown, no code blocks):

{
  "itinerary": [
    {
      "day": 1,
      "theme": "Historic East Tokyo",
      "places": [
        { "id": "place-uuid-1", "order": 0 },
        { "id": "place-uuid-2", "order": 1 }
      ],
      "estimated_travel_time_minutes": 45,
      "estimated_visit_time_minutes": 180
    }
  ],
  "reasoning": "Grouped Asakusa temples on Day 1 because they are within 2km of each other, minimizing travel time. Ordered them west-to-east to avoid backtracking..."
}

## Critical Rules
1. Every place from the input MUST appear exactly once in the output
2. Places within a day MUST be ordered by the "order" field (0, 1, 2...)
3. Total time per day (travel + visits) should not exceed 12 hours
4. Provide clear reasoning explaining your clustering and routing decisions
5. Return pure JSON only (no markdown formatting)

## Quality Indicators
- Minimal total travel distance across all days
- No geographic ping-ponging (going back and forth)
- Balanced number of activities per day
- Realistic time constraints respected`;

/**
 * Build the user prompt with place data and trip parameters
 */
export function buildItineraryPrompt(places: Place[], tripDays: number): string {
  const placesList = places
    .map((p, i) => {
      const category = p.category || 'other';
      return `${i + 1}. ID: "${p.id}" - "${p.name}" (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}) [${category}]`;
    })
    .join('\n');

  return `Create a ${tripDays}-day itinerary for these ${places.length} places:

${placesList}

CRITICAL REQUIREMENTS:
1. You MUST include ALL ${places.length} places in your itinerary - no exceptions
2. Each place ID must appear exactly once in the output
3. Distribute places across ${tripDays} days
4. Minimize total travel distance
5. Ensure each day is feasible (under 12 hours total)
6. Group nearby places on the same day
7. Order places within each day to avoid backtracking

Before returning, verify you have included all ${places.length} place IDs:
${places.map((p) => `- ${p.id}`).join('\n')}

Return the JSON itinerary now.`;
}

/**
 * Validate that AI response includes all input places
 */
export function validateItinerary(
  inputPlaces: Place[],
  itinerary: { day: number; places: { id: string; order: number }[] }[]
): { valid: boolean; error?: string } {
  const inputIds = new Set(inputPlaces.map((p) => p.id));
  const outputIds = new Set<string>();

  for (const day of itinerary) {
    for (const place of day.places) {
      if (outputIds.has(place.id)) {
        return {
          valid: false,
          error: `Duplicate place ID in itinerary: ${place.id}`,
        };
      }
      outputIds.add(place.id);
    }
  }

  // Check all input places are in output
  for (const id of inputIds) {
    if (!outputIds.has(id)) {
      return {
        valid: false,
        error: `Missing place in itinerary: ${id}`,
      };
    }
  }

  // Check no extra places in output
  for (const id of outputIds) {
    if (!inputIds.has(id)) {
      return {
        valid: false,
        error: `Unknown place ID in itinerary: ${id}`,
      };
    }
  }

  return { valid: true };
}

/**
 * System prompt for conversational search assistant (Phase 8)
 */
export const SEARCH_ASSISTANT_SYSTEM_PROMPT = `You are a travel search assistant helping users find places to add to their trip.

## Your Capabilities
You have access to a "search_places" tool that searches for locations using Mapbox Geocoding.

## Your Behavior
1. When users ask for place recommendations, use the search_places tool
2. Filter results by quality (prefer higher-rated places)
3. Automatically add top results to their map
4. Explain why you chose each place (ratings, proximity, popularity)
5. Be proactive - if coordinates aren't provided, search globally

## Example Interaction
User: "Add 3 coffee shops in Shibuya"
You: *use search_places with query="coffee shops shibuya"*
You: "I found several great options! Added:
1. Blue Bottle Coffee - Popular specialty coffee
2. % Arabica Shibuya - Known for latte art
3. Streamer Coffee - Local favorite with great atmosphere"

Be helpful, concise, and action-oriented.`;

