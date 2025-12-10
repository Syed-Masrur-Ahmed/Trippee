import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { clusterPlaces, optimizeRoute, calculateRouteDistance, estimateTravelTime } from '@/lib/utils/geo';

// Zod schema for AI output (only themes and reasoning)
const ThemeSchema = z.object({
  themes: z.array(
    z.object({
      day: z.number().int().min(1).max(14),
      theme: z.string(),
    })
  ),
  reasoning: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
      return NextResponse.json(
        { error: 'AI service is not configured. Please set GOOGLE_GENERATIVE_AI_API_KEY.' },
        { status: 500 }
      );
    }

    const { places, tripDays } = await request.json();

    if (!places || !Array.isArray(places) || places.length === 0) {
      return NextResponse.json({ error: 'Places array is required' }, { status: 400 });
    }

    if (!tripDays || tripDays < 1 || tripDays > 14) {
      return NextResponse.json({ error: 'tripDays must be between 1 and 14' }, { status: 400 });
    }

    // Step 1: Deterministic clustering using k-means
    // Convert to format expected by clusterPlaces (id, name, lat, lng)
    const placesForClustering = places.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
    }));
    const clusters = clusterPlaces(placesForClustering, tripDays);
    
    if (clusters.length === 0) {
      return NextResponse.json(
        { error: 'Failed to cluster places' },
        { status: 500 }
      );
    }

    // Step 2: Optimize routes within each cluster
    const optimizedClusters = clusters.map((cluster) => optimizeRoute(cluster));

    // Step 3: Build structured itinerary with deterministic data
    const structuredItinerary = optimizedClusters.map((cluster, dayIndex) => {
      const day = dayIndex + 1;
      const totalDistance = calculateRouteDistance(cluster);
      const estimatedTravelTime = estimateTravelTime(totalDistance);
      
      // Estimate visit time (rough: 90 min per place average)
      const estimatedVisitTime = cluster.length * 90;

      // Create a map for quick lookup of original place data
      const placesMap = new Map(places.map((p) => [p.id, p]));

      return {
        day,
        places: cluster.map((place, order) => ({
          id: place.id,
          order,
        })),
        estimated_travel_time_minutes: estimatedTravelTime,
        estimated_visit_time_minutes: estimatedVisitTime,
        // Place details for AI to generate theme
        placeDetails: cluster.map((p) => {
          const originalPlace = placesMap.get(p.id);
          return {
            id: p.id,
            name: p.name,
            category: originalPlace?.category || 'other',
            lat: p.lat,
            lng: p.lng,
          };
        }),
      };
    });

    // Step 4: Send to AI only for themes and reasoning
    const themePrompt = `Given these pre-organized travel days, suggest a theme name for each day and explain the reasoning:

${structuredItinerary
  .map(
    (day) => `Day ${day.day}:
${day.placeDetails.map((p) => `  - ${p.name} (${p.category})`).join('\n')}
  Total travel: ~${day.estimated_travel_time_minutes} minutes
  Total visit time: ~${day.estimated_visit_time_minutes} minutes`
  )
  .join('\n\n')}

For each day, suggest:
1. A concise theme name (e.g., "Historic East Tokyo", "Modern Shopping District")
2. Brief reasoning explaining why these places work well together

Return JSON with themes array and overall reasoning.`;

    const { object: themeData } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: ThemeSchema,
      system: `You are a travel theme generator. Given pre-organized travel days, suggest thematic names and explain why the grouping makes sense. Be concise and creative.`,
      prompt: themePrompt,
      temperature: 0.8, // More creativity for themes
    });

    // Step 5: Combine deterministic structure with AI themes
    const finalItinerary = structuredItinerary.map((day) => {
      const theme = themeData.themes.find((t) => t.day === day.day);
      return {
        day: day.day,
        theme: theme?.theme || `Day ${day.day} Itinerary`,
        places: day.places,
        estimated_travel_time_minutes: day.estimated_travel_time_minutes,
        estimated_visit_time_minutes: day.estimated_visit_time_minutes,
      };
    });

    return NextResponse.json({
      itinerary: finalItinerary,
      reasoning: themeData.reasoning,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorStatus = (error as { status?: number })?.status;

    // Handle rate limiting
    if (errorMessage.includes('429') || errorStatus === 429 || errorMessage.includes('quota')) {
      return NextResponse.json(
        { error: 'AI service is rate limited. Please try again in 60 seconds.' },
        { status: 429 }
      );
    }

    // Handle API key errors
    if (errorMessage.includes('API key') || errorMessage.includes('authentication')) {
      return NextResponse.json(
        { error: 'Invalid API key. Please check GOOGLE_GENERATIVE_AI_API_KEY in .env.local' },
        { status: 500 }
      );
    }

    // Handle other errors with more detail
    return NextResponse.json(
      {
        error: errorMessage || 'Failed to generate itinerary',
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

