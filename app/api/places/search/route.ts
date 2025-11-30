import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  // Don't use proximity - let Mapbox search globally
  // Include POI (points of interest) for schools, landmarks, etc.
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?types=poi,address,place&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=10`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      return NextResponse.json({ results: [] });
    }

    return NextResponse.json({
      results: data.features.map((f: any) => ({
        id: f.id,
        name: f.text || f.place_name,
        address: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
        category: f.properties.category || 'other',
      })),
    });
  } catch (error) {
    console.error('Geocoding API error:', error);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}