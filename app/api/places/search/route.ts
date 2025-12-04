import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const limit = parseInt(searchParams.get('limit') || '5', 10);

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // Check for API key
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_PLACES_API_KEY is not set');
    return NextResponse.json({ 
      results: [],
      error: 'API key not configured. Please set GOOGLE_PLACES_API_KEY environment variable.'
    }, { status: 500 });
  }

  console.log('Searching for:', query, 'with API key:', apiKey ? 'SET' : 'NOT SET');

  try {
    // Use the new Google Places API (New) - Text Search endpoint
    // This uses POST requests and provides better results
    const url = 'https://places.googleapis.com/v1/places:searchText';

    // Build request body
    const requestBody: any = {
      textQuery: query,
      maxResultCount: limit,
      // Don't restrict by type - let Google return all relevant places
    };

    // Add location bias if coordinates are provided
    if (lat && lng) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: parseFloat(lat),
            longitude: parseFloat(lng),
          },
          radius: 50000.0, // 50km radius in meters
        },
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Places API (New) error:', response.status, errorData);
      console.error('Request body was:', JSON.stringify(requestBody, null, 2));
      return NextResponse.json({ results: [] }, { status: response.status });
    }

    const data = await response.json();
    console.log('Google Places API response:', JSON.stringify(data, null, 2));

    if (!data.places || data.places.length === 0) {
      console.log('No places found in response. Full response:', JSON.stringify(data, null, 2));
      return NextResponse.json({ results: [] });
    }

    // Map Google Places categories to database-allowed categories
    const mapCategory = (googleCategory: string): string => {
      const normalized = googleCategory.toLowerCase().replace(/_/g, ' ');
      
      // Food & Drink
      if (normalized.includes('restaurant') || normalized.includes('cafe') || 
          normalized.includes('coffee') || normalized.includes('bar') ||
          normalized.includes('food') || normalized.includes('dining') ||
          normalized.includes('bakery') || normalized.includes('bistro')) {
        return 'restaurant';
      }
      
      // Hotels & Lodging
      if (normalized.includes('hotel') || normalized.includes('lodging') ||
          normalized.includes('accommodation') || normalized.includes('hostel')) {
        return 'hotel';
      }
      
      // Shopping
      if (normalized.includes('store') || normalized.includes('shop') ||
          normalized.includes('shopping') || normalized.includes('market') ||
          normalized.includes('mall') || normalized.includes('boutique')) {
        return 'shopping';
      }
      
      // Transportation
      if (normalized.includes('station') || normalized.includes('airport') ||
          normalized.includes('transit') || normalized.includes('transport') ||
          normalized.includes('subway') || normalized.includes('train') ||
          normalized.includes('bus') || normalized.includes('taxi')) {
        return 'transport';
      }
      
      // Attractions (museums, parks, landmarks, etc.)
      if (normalized.includes('museum') || normalized.includes('park') ||
          normalized.includes('attraction') || normalized.includes('landmark') ||
          normalized.includes('monument') || normalized.includes('temple') ||
          normalized.includes('shrine') || normalized.includes('gallery') ||
          normalized.includes('theater') || normalized.includes('theatre') ||
          normalized.includes('zoo') || normalized.includes('aquarium') ||
          normalized.includes('beach') || normalized.includes('viewpoint')) {
        return 'attraction';
      }
      
      // Default to 'other'
      return 'other';
    };

    // Transform Google Places API (New) response to match expected format
    const results = data.places.slice(0, limit).map((place: any) => {
      // Extract category from types array and map to database category
      let category = 'other';
      if (place.types && place.types.length > 0) {
        // Try to map the first type, or check all types for a better match
        for (const type of place.types) {
          const mapped = mapCategory(type);
          if (mapped !== 'other') {
            category = mapped;
            break;
          }
        }
        // If no match found, use the first type
        if (category === 'other') {
          category = mapCategory(place.types[0]);
        }
      }

      return {
        id: place.id,
        name: place.displayName?.text || 'Unknown Place',
        address: place.formattedAddress || 'Address not available',
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        category: category,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Google Places API (New) error:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}