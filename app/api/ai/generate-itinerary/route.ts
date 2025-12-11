import { NextRequest, NextResponse } from 'next/server';
import { clusterPlaces, optimizeRoute, calculateRouteDistance, estimateTravelTime } from '@/lib/utils/geo';

export async function POST(request: NextRequest) {
  try {
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
    const itinerary = optimizedClusters.map((cluster, dayIndex) => {
      const day = dayIndex + 1;
      const totalDistance = calculateRouteDistance(cluster);
      const estimatedTravelTime = estimateTravelTime(totalDistance);
      
      // Estimate visit time (rough: 90 min per place average)
      const estimatedVisitTime = cluster.length * 90;

      return {
        day,
        places: cluster.map((place, order) => ({
          id: place.id,
          order,
        })),
        estimated_travel_time_minutes: estimatedTravelTime,
        estimated_visit_time_minutes: estimatedVisitTime,
      };
    });

    return NextResponse.json({
      itinerary,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json(
      {
        error: errorMessage || 'Failed to generate itinerary',
        details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

