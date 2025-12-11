import { NextRequest, NextResponse } from 'next/server';
import { GooglePlacePhoto, GooglePlaceReview } from '@/lib/supabase/schema.types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
  }

  // Check for API key
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ 
      error: 'API key not configured. Please set GOOGLE_PLACES_API_KEY environment variable.'
    }, { status: 500 });
  }

  try {
    // Use Google Places API (New) - Place Details endpoint
    const url = `https://places.googleapis.com/v1/places/${placeId}`;

    // Request comprehensive fields
    const fieldMask = [
      'id',
      'displayName',
      'formattedAddress',
      'location',
      'types',
      'rating',
      'userRatingCount',
      'nationalPhoneNumber',
      'websiteUri',
      'regularOpeningHours',
      'priceLevel',
      'photos',
      'reviews',
      'editorialSummary',
    ].join(',');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch place details' }, { status: response.status });
    }

    const data = await response.json();

    // Transform Google Places API response to a more usable format
    const result = {
      id: data.id,
      name: data.displayName?.text || 'Unknown Place',
      formattedAddress: data.formattedAddress || 'Address not available',
      location: data.location ? {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
      } : null,
      types: data.types || [],
      category: data.types?.[0] || 'other',
      rating: data.rating || null,
      userRatingCount: data.userRatingCount || null,
      phoneNumber: data.nationalPhoneNumber || null,
      website: data.websiteUri || null,
      openingHours: data.regularOpeningHours ? {
        weekdayDescriptions: data.regularOpeningHours.weekdayDescriptions || [],
        openNow: data.regularOpeningHours.openNow || null,
      } : null,
      priceLevel: data.priceLevel || null,
      photos: data.photos?.slice(0, 5).map((photo: GooglePlacePhoto) => ({
        name: photo.name,
        widthPx: photo.widthPx,
        heightPx: photo.heightPx,
      })) || [],
      reviews: data.reviews?.slice(0, 5).map((review: GooglePlaceReview) => ({
        rating: review.rating,
        text: review.text?.text || '',
        authorName: review.authorName || 'Anonymous',
      })) || [],
      editorialSummary: data.editorialSummary?.text || null,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
  }
}

