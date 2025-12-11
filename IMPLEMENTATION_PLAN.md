# Implementation Plan: Trippee
## Step-by-Step Development Roadmap

**Version:** 1.0  
**Estimated Timeline:** 4-5 weeks (1 developer)  
**Last Updated:** December 2025  
**Status:** COMPLETED - Reference Documentation

> **Note:** This document is retained as reference documentation for the completed MVP. 
> All phases have been implemented successfully.

---

## Overview

This plan breaks down Trippee development into **12 phases** with **70+ discrete tasks**. Each phase is designed to produce a working, testable increment.

**Phase Summary:**
- Phase 0: Project Bootstrap
- Phase 1: Database Schema & Supabase Setup
- Phase 1.5: Authentication & User Management
- Phase 2: Basic Map Integration
- Phase 3: Place CRUD Operations
- Phase 4: Itinerary Sidebar UI
- Phase 5: Real-Time Collaboration
- Phase 6: Geocoding & Search
- Phase 7: AI Itinerary Generation
- Phase 8: AI Chat Assistant
- Phase 8.5: Trip Sharing & Invitations
- Phase 9: User Dashboard & Trip Management
- Phase 9.5: Trip Deletion & Ownership Management
- Phase 10: Polish & Deployment

### Development Principles
1. **No Big Bang:** Each phase ships a functional feature
2. **Test as You Go:** Manual testing after each phase before moving forward
3. **Database First:** Schema must be stable before building UI
4. **AI Last:** Core CRUD operations work before adding AI layer

---

## Phase 0: Project Bootstrap (Day 1)

### 0.1 Initialize Next.js Project
```bash
npx create-next-app@latest trippee --typescript --tailwind --app --no-src-dir
cd trippee
```

**Configuration choices:**
- TypeScript
- Tailwind CSS
- App Router
- src/ directory (keep flat structure) - NO
- Import alias (@/*)

### 0.2 Install Core Dependencies
```bash
npm install react-map-gl mapbox-gl
npm install @supabase/supabase-js @supabase/ssr
npm install ai @ai-sdk/google zod
npm install lucide-react
npm install -D @types/mapbox-gl
```

**Verification:** Run `npm run dev`, ensure no errors

### 0.3 Setup Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
GOOGLE_GENERATIVE_AI_API_KEY=AI...
```

**Action Items:**
- [x] Create Mapbox account, get token
- [x] Create Supabase project, get credentials
- [x] Get Google AI Studio API key (free tier)
- [x] Get Google Places API key (New API)

### 0.4 Create Project Structure
```
/app
  /trip/[tripId]
    page.tsx          # Main trip view
  /api
    /ai
      /generate-itinerary
        route.ts
      /chat
        route.ts
    /places
      /search
        route.ts
  layout.tsx
  page.tsx            # Landing/trip creation
/components
  /map
    MapView.tsx
    MapMarker.tsx
  /itinerary
    ItineraryPanel.tsx
    PlaceCard.tsx
  /ai
    ChatDrawer.tsx
/lib
  /supabase
    client.ts
    schema.types.ts
  /ai
    prompts.ts
  /utils
    geo.ts            # Haversine distance, clustering
/types
  index.ts
```

**Deliverable:** Empty files with TypeScript interfaces stubbed

---

## Phase 1: Database Schema & Supabase Setup (Day 1-2)

### 1.1 Enable Supabase Authentication
In Supabase Dashboard:
1. Go to Authentication → Providers
2. Enable **Email** provider
3. Enable **Google** OAuth provider
   - Add Google OAuth credentials (Client ID & Secret from Google Cloud Console)
   - Set redirect URL: `https://<your-project>.supabase.co/auth/v1/callback`
4. Configure email templates (optional, use defaults)

**Action Items:**
- [ ] Create Google Cloud OAuth app (if needed)
- [ ] Add OAuth credentials to Supabase
- [ ] Test email signup flow

### 1.2 Create Supabase Tables - COMPLETED
**Status:** All tables created with migrations. See `supabase/migrations/001_auth_schema.sql`

In Supabase SQL Editor, run:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trips table
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  trip_days INTEGER DEFAULT 3 CHECK (trip_days > 0 AND trip_days <= 14),
  start_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Trip members (for collaboration)
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, user_id)
);

-- Places table
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL CHECK (lat >= -90 AND lat <= 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng >= -180 AND lng <= 180),
  category TEXT CHECK (category IN ('restaurant', 'attraction', 'hotel', 'shopping', 'transport', 'other')),
  day_assigned INTEGER CHECK (day_assigned >= 1 AND day_assigned <= 14),
  order_index INTEGER CHECK (order_index >= 0),
  notes TEXT,
  address TEXT,
  place_id TEXT, -- External ID (Mapbox, Google Places)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Trip invitations table
CREATE TABLE trip_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Indexes for performance
CREATE INDEX idx_places_trip_id ON places(trip_id);
CREATE INDEX idx_places_trip_day ON places(trip_id, day_assigned);
CREATE INDEX idx_places_created_at ON places(created_at DESC);
CREATE INDEX idx_trip_members_trip_id ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user_id ON trip_members(user_id);
CREATE INDEX idx_trips_created_by ON trips(created_by);
CREATE INDEX idx_trip_invitations_token ON trip_invitations(token);
CREATE INDEX idx_trip_invitations_email ON trip_invitations(email);

-- Row Level Security Policies

-- Trips: Users can read trips they're members of
CREATE POLICY "Users can view trips they're members of"
  ON trips FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trips.id
      AND trip_members.user_id = auth.uid()
    )
  );

-- Trips: Users can create trips
CREATE POLICY "Users can create trips"
  ON trips FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Trips: Owners can update their trips
CREATE POLICY "Trip owners can update trips"
  ON trips FOR UPDATE
  USING (created_by = auth.uid());

-- Trip members: Users can view members of trips they're in
CREATE POLICY "Users can view trip members"
  ON trip_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
      AND tm.user_id = auth.uid()
    )
  );

-- Trip members: Trip owners can add members
CREATE POLICY "Trip owners can add members"
  ON trip_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.created_by = auth.uid()
    )
  );

-- Places: Users can read places in trips they're members of
CREATE POLICY "Users can view places in their trips"
  ON places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can create places
CREATE POLICY "Trip members can create places"
  ON places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can update places
CREATE POLICY "Trip members can update places"
  ON places FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Places: Trip members can delete places
CREATE POLICY "Trip members can delete places"
  ON places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = places.trip_id
      AND (
        trips.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM trip_members
          WHERE trip_members.trip_id = trips.id
          AND trip_members.user_id = auth.uid()
        )
      )
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Verification:** 
- [x] Insert test data manually in Supabase Table Editor
- [x] Test RLS policies by creating test users
- [x] Verify profile is auto-created on signup

**Additional Migrations Created:**
- `002_trip_messages_rls.sql` - RLS policies for chat messages
- `003_add_creators_to_trip_members.sql` - Backfill trip creators as members
- `006_fix_trip_creation_rls.sql` - Fix handle_new_user trigger permissions
- `007_remove_get_user_email_function.sql` - Remove problematic function
- `008_allow_invitation_acceptance.sql` - Allow invitation acceptance and profile viewing

### 1.2 Generate TypeScript Types
Install Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase gen types typescript --local > lib/supabase/schema.types.ts
```

**Expected Output:** `Database` type with `trips`, `places`, `profiles`, `trip_members`, and `trip_invitations` interfaces

### 1.3 Create Supabase Client Utilities
File: `lib/supabase/client.ts`
```typescript
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

export async function updatePlace(id: string, updates: Database['public']['Tables']['places']['Update']) {
  return supabase.from('places').update(updates).eq('id', id).select().single();
}

export async function deletePlace(id: string) {
  return supabase.from('places').delete().eq('id', id);
}
```

**Testing:** Create a test Next.js page that calls `getTrip()`, verify it returns data

---

## Phase 1.5: Authentication & User Management (Day 2-3)

### 1.5.1 Setup Supabase Auth Helpers
Install Supabase SSR package:
```bash
npm install @supabase/ssr
```

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
```

Create `lib/supabase/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
```

Create `middleware.ts` in root:
```typescript
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 1.5.2 Create Authentication Components
File: `components/auth/AuthModal.tsx`

**Features:**
- Email/password signup and login
- Google OAuth button
- Form validation
- Error handling

**Implementation:**
```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Show success message
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-2xl font-bold mb-4">
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </h2>
        
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={handleGoogleAuth}
            className="w-full bg-white border border-gray-300 py-2 rounded flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              {/* Google icon SVG */}
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="mt-4 text-center text-sm">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-500"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

### 1.5.3 Create Auth Callback Route
File: `app/auth/callback/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
```

### 1.5.4 Create User Context/Hook
File: `lib/hooks/useAuth.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
```

### 1.5.5 Add Auth to Layout
File: `app/layout.tsx`

```typescript
import { AuthProvider } from '@/components/auth/AuthProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

**Testing:**
- [x] User can sign up with email/password
- [x] User can sign in with email/password
- [x] User can sign in with Google OAuth
- [x] Profile is automatically created on signup
- [x] User session persists across page refreshes
- [x] User can sign out

**Completed Features:**
- [COMPLETED] AuthModal component with email/password and Google OAuth
- [COMPLETED] AuthProvider context for global auth state
- [COMPLETED] useAuth hook for client-side auth access
- [COMPLETED] Server-side Supabase client with cookie handling
- [COMPLETED] Middleware for session refresh
- [COMPLETED] Auth callback route for OAuth redirects
- [COMPLETED] Header component with user info and sign out
- [COMPLETED] Hydration mismatch fixes

---

## Phase 2: Basic Map Integration (Day 3-4)

### 2.1 Create MapView Component
File: `components/map/MapView.tsx`

**Requirements:**
- Full-screen map (width: 100vw, height: 100vh)
- Initial viewport: Center on [0, 0], zoom 2
- Click handler to add pins (log lat/lng for now)
- Use Mapbox style: `mapbox://styles/mapbox/streets-v12`

**Implementation:**
```typescript
'use client';

import Map, { Marker } from 'react-map-gl';
import { useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapViewProps {
  places: Array<{ id: string; lat: number; lng: number; name: string }>;
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapView({ places, onMapClick }: MapViewProps) {
  const [viewport, setViewport] = useState({
    latitude: 35.6762,
    longitude: 139.6503,
    zoom: 10,
  });

  return (
    <Map
      {...viewport}
      onMove={(evt) => setViewport(evt.viewState)}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      style={{ width: '100%', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      onClick={(e) => onMapClick(e.lngLat.lat, e.lngLat.lng)}
    >
      {places.map((place) => (
        <Marker key={place.id} latitude={place.lat} longitude={place.lng}>
          <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white" />
        </Marker>
      ))}
    </Map>
  );
}
```

**Testing:** 
- [x] Verify map renders without console errors
- [x] Click map, confirm `onMapClick` fires with correct coordinates

**Completed Features:**
- [COMPLETED] MapView component with react-map-gl
- [COMPLETED] Map markers for places
- [COMPLETED] Fixed positioning to prevent scrolling issues
- [COMPLETED] SearchBar with z-index fixes

### 2.2 Create Trip Page with Map
File: `app/trip/[tripId]/page.tsx`

```typescript
import { getTrip, getPlaces } from '@/lib/supabase/client';
import MapView from '@/components/map/MapView';
import { notFound } from 'next/navigation';

export default async function TripPage({ params }: { params: { tripId: string } }) {
  const { data: trip, error: tripError } = await getTrip(params.tripId);
  const { data: places, error: placesError } = await getPlaces(params.tripId);
  
  if (tripError || !trip) {
    notFound();
  }

  return (
    <main>
      <MapView 
        places={places || []} 
        onMapClick={(lat, lng) => console.log('Clicked:', lat, lng)} 
      />
      </main>
  );
}
```

**Testing:**
- Create a trip manually in Supabase
- Navigate to `/trip/<uuid>`
- Confirm map loads with existing places

---

## Phase 3: Place CRUD Operations (Day 3-4)

### 3.1 Add Client-Side State Management
Convert `TripPage` to Client Component with state:

File: `app/trip/[tripId]/page.tsx` (refactored)
```typescript
'use client';

import { useEffect, useState } from 'react';
import { getTrip, getPlaces, createPlace } from '@/lib/supabase/client';
import MapView from '@/components/map/MapView';

export default function TripPage({ params }: { params: { tripId: string } }) {
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data } = await getPlaces(params.tripId);
    setPlaces(data || []);
    setLoading(false);
  }

  async function handleMapClick(lat: number, lng: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to add places');
      return;
    }

    const newPlace = {
      trip_id: params.tripId,
      name: 'New Place',
      lat,
      lng,
      category: 'other' as const,
      created_by: user.id,
    };

    const { data } = await createPlace(newPlace);
    if (data) {
      setPlaces([...places, data]);
    }
  }

  if (loading) return <div>Loading...</div>;

  return <MapView places={places} onMapClick={handleMapClick} />;
}
```

**Testing:**
- [x] Click map, verify new pin appears instantly
- [x] Refresh page, confirm pin persists (saved to DB)

**Completed Features:**
- [COMPLETED] PlaceModal for editing/deleting places
- [COMPLETED] Real-time place updates via Supabase Realtime
- [COMPLETED] Custom event fallback for place creation
- [COMPLETED] 3-dot menu on itinerary places for quick edit/delete

### 3.2 Add Place Name Edit Modal
Create `components/map/PlaceModal.tsx`:

**Features:**
- Click marker → open modal with name input
- Update name → save to DB
- Delete button → remove from DB

**Implementation:** Use Headless UI or native `<dialog>` element

**Testing:**
- Click pin → modal opens
- Edit name → saves correctly
- Delete → pin disappears

---

## Phase 4: Itinerary Sidebar UI (Day 4-5)

### 4.1 Create ItineraryPanel Component
File: `components/itinerary/ItineraryPanel.tsx`

**Layout:**
```
┌─────────────────────┐
│  Unassigned (5)     │
│  ┌───────────────┐  │
│  │ Place 1       │  │
│  └───────────────┘  │
├─────────────────────┤
│  Day 1              │
│  ┌───────────────┐  │
│  │ Place 2       │  │
│  └───────────────┘  │
├─────────────────────┤
│  Day 2              │
│  ...                │
└─────────────────────┘
```

**Requirements:**
- Fixed width sidebar (320px) on desktop
- Collapsible on mobile (drawer)
- Group places by `day_assigned` (null = Unassigned)
- Order by `order_index` within each day

**Testing:**
- [x] Add 3 places, confirm all appear in "Unassigned"
- [x] Manually set `day_assigned=1` in DB, refresh, confirm place moves to Day 1

**Completed Features:**
- [COMPLETED] ItineraryPanel with collapsible "Unassigned" section (max-height with scroll)
- [COMPLETED] Drag-and-drop reordering (using @dnd-kit)
- [COMPLETED] 3-dot menu on each place card for quick edit/delete
- [COMPLETED] Improved text readability (fixed grey text issues)

### 4.2 Implement Drag-and-Drop Reordering
Library: `@dnd-kit/core` (install: `npm install @dnd-kit/core`)

**Features:**
- Drag place from Unassigned → Day 1 (sets `day_assigned=1`)
- Drag within Day 1 to reorder (updates `order_index`)
- Drag from Day 1 → Day 2 (changes `day_assigned`)

**Implementation Steps:**
1. Wrap `ItineraryPanel` with `DndContext`
2. Make each `PlaceCard` a `useDraggable` item
3. Make each day column a `useDroppable` zone
4. On drop, call `updatePlace()` with new day/order

**Testing:**
- Drag place to Day 1, verify DB updates
- Drag to reorder within day, verify order_index changes
- Refresh page, confirm order persists

---

## Phase 5: Real-Time Collaboration (Day 5-7)

### 5.1 Setup Supabase Realtime Channel
File: `lib/supabase/realtime.ts`

```typescript
import { supabase } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeEvent = 
  | { type: 'place_added'; place: any }
  | { type: 'place_updated'; id: string; updates: any }
  | { type: 'place_deleted'; id: string }
  | { type: 'cursor_move'; user_id: string; lat: number; lng: number; color: string };

export function subscribeToTrip(
  tripId: string,
  onEvent: (event: RealtimeEvent) => void
): RealtimeChannel {
  const channel = supabase.channel(`trip:${tripId}`);

  channel
    .on('broadcast', { event: 'place_event' }, ({ payload }) => {
      onEvent(payload as RealtimeEvent);
    })
    .subscribe();

  return channel;
}

export function broadcastEvent(channel: RealtimeChannel, event: RealtimeEvent) {
  channel.send({
        type: 'broadcast',
    event: 'place_event',
    payload: event,
  });
}
```

### 5.2 Integrate Realtime into TripPage
Modify `app/trip/[tripId]/page.tsx`:

```typescript
useEffect(() => {
  const channel = subscribeToTrip(params.tripId, handleRealtimeEvent);
  return () => {
    channel.unsubscribe();
  };
}, []);

function handleRealtimeEvent(event: RealtimeEvent) {
  switch (event.type) {
    case 'place_added':
      setPlaces((prev) => [...prev, event.place]);
      break;
    case 'place_updated':
      setPlaces((prev) =>
        prev.map((p) => (p.id === event.id ? { ...p, ...event.updates } : p))
      );
      break;
    case 'place_deleted':
      setPlaces((prev) => prev.filter((p) => p.id !== event.id));
      break;
  }
}

async function handleMapClick(lat: number, lng: number) {
  const newPlace = { /* ... */ };
  const { data } = await createPlace(newPlace);
  if (data) {
    setPlaces([...places, data]);
    broadcastEvent(channel, { type: 'place_added', place: data });
  }
}
```

**Testing:**
1. Open same trip in two browser windows
2. Add pin in Window A
3. Verify pin appears in Window B within 1 second

### 5.3 Implement Cursor Tracking
Add to `MapView.tsx`:

```typescript
const { user } = useAuth();
const [cursors, setCursors] = useState<Map<string, { lat: number; lng: number; color: string; name: string }>>(
  new Map()
);

useEffect(() => {
  if (!user) return;

  const channel = subscribeToTrip(tripId, (event) => {
    if (event.type === 'cursor_move') {
      setCursors((prev) => new Map(prev).set(event.user_id, { 
        lat: event.lat, 
        lng: event.lng, 
        color: event.color,
        name: event.user_name || 'User'
      }));
    }
  });

  // Send own cursor position
  const interval = setInterval(() => {
    const center = map.getCenter();
    broadcastEvent(channel, {
      type: 'cursor_move',
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email,
      lat: center.lat,
      lng: center.lng,
      color: getUserColor(user.id),
    });
  }, 100);

  return () => {
    clearInterval(interval);
    channel.unsubscribe();
  };
}, [user]);

// Render cursors as markers with user names
{Array.from(cursors.entries()).map(([userId, cursor]) => (
  <Marker key={userId} latitude={cursor.lat} longitude={cursor.lng}>
    <div className="relative">
      <div style={{ backgroundColor: cursor.color }} className="w-4 h-4 rounded-full border-2 border-white" />
      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-black text-white px-2 py-1 rounded whitespace-nowrap">
        {cursor.name}
      </span>
    </div>
  </Marker>
))}
```

**Testing:**
- [x] Open two windows with different users, move map in Window A
- [x] Verify colored dot with user name follows in Window B

**Completed Features:**
- [COMPLETED] Supabase Broadcast for real-time place updates
- [COMPLETED] Cursor tracking with user names and colors
- [COMPLETED] Real-time itinerary order updates
- [COMPLETED] Supabase Realtime postgres_changes for places table

---

## Phase 6: Geocoding & Search (Day 7-8)

### 6.1 Create Search API Route [COMPLETED]
File: `app/api/places/search/route.ts`

**Implementation:** Switched from Mapbox Geocoding to Google Places API (New) for better category-based search results.

**Key Features:**
- Uses `places.googleapis.com/v1/places:searchText` endpoint
- POST requests with API key in `X-Goog-Api-Key` header
- Field masks for optimized performance
- Category mapping (Google categories → database categories)
- Default limit of 5 results
- Circle-based location bias support

**Migration Notes:**
- Replaced Mapbox Geocoding API with Google Places API (New)
- Added category mapping logic to convert Google Places types to database categories
- Improved search results for category-based queries (e.g., "cafes in Shibuya")

### 6.2 Add Search Bar to Map
File: `components/map/SearchBar.tsx`

**Features:**
- Input with debounce (500ms)
- Dropdown showing results (max 5)
- Click result → add pin to map automatically

**Testing:**
- [x] Type "coffee shibuya"
- [x] Verify results appear
- [x] Click result → pin added at correct location

**Completed Features:**
- [COMPLETED] SearchBar component with Google Places API integration
- [COMPLETED] Debounced search input
- [COMPLETED] Results dropdown (max 5)
- [COMPLETED] Safety checks for undefined results

---

## Phase 7: Itinerary Generation (Day 8-10) [COMPLETED]

**Status:** Fully deterministic implementation using k-means clustering and route optimization (AI removed)

### 7.1 Create Geospatial Utility Functions
File: `lib/utils/geo.ts`

```typescript
// Haversine formula to calculate distance between two lat/lng points
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// K-means clustering with k-means++ initialization
export function clusterPlaces(places: Array<{ lat: number; lng: number }>, k: number) {
  // Implementation: K-means++ style initialization, empty cluster handling, 1km convergence threshold
  // Return: Array of clusters (each cluster is array of place indices)
}

// Route optimization (greedy nearest-neighbor)
export function optimizeRoute(places: Array<{ lat: number; lng: number }>) {
  // Implementation: Greedy TSP solver
  // Return: Optimized order array
}
```

**Testing:** 
- [x] Unit tests for distance calculation (Tokyo to Osaka = ~400km)
- [x] Clustering handles edge cases (fewer places than clusters, empty clusters)
- [x] Single unassigned place can be assigned to nearest existing day

### 7.2 Create Itinerary Generation API Route
File: `app/api/ai/generate-itinerary/route.ts`

**Implementation:**
- Fully deterministic algorithm (no AI required)
- Uses k-means clustering to group places geographically
- Optimizes routes within each cluster using nearest-neighbor algorithm
- Calculates travel time and visit time estimates
- Returns structured itinerary with day assignments and order

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { clusterPlaces, optimizeRoute, calculateRouteDistance, estimateTravelTime } from '@/lib/utils/geo';

export async function POST(request: NextRequest) {
  const { places, tripDays } = await request.json();
  
  // Step 1: Cluster places using k-means
  const clusters = clusterPlaces(places, tripDays);
  
  // Step 2: Optimize routes within each cluster
  const optimizedClusters = clusters.map((cluster) => optimizeRoute(cluster));
  
  // Step 3: Build structured itinerary
  const itinerary = optimizedClusters.map((cluster, dayIndex) => {
    const day = dayIndex + 1;
    const totalDistance = calculateRouteDistance(cluster);
    const estimatedTravelTime = estimateTravelTime(totalDistance);
    const estimatedVisitTime = cluster.length * 90; // 90 min per place average
    
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
  
  return NextResponse.json({ itinerary });
}
```

**Testing:**
- Send POST request with 10 places
- Verify response matches schema
- Check that all place IDs are accounted for

### 7.4 Integrate AI Button into UI
Add Floating Action Button (FAB) to `TripPage`:

```typescript
<button
  onClick={handleGenerateItinerary}
  className="fixed bottom-8 right-8 bg-purple-600 text-white px-6 py-3 rounded-full shadow-lg"
>
  Generate Itinerary
</button>

async function handleGenerateItinerary() {
  setLoading(true);
  const response = await fetch('/api/ai/generate-itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      places: places.filter((p) => !p.day_assigned), // Only unassigned places
      tripDays: 3,
    }),
  });

  const { itinerary } = await response.json();

  // Update DB for all places
  for (const day of itinerary) {
    for (const place of day.places) {
      await updatePlace(place.id, {
        day_assigned: day.day,
        order_index: place.order,
      });
    }
  }

  // Reload places
  await loadData();
  setLoading(false);
}
```

**Testing:**
- [x] Add 10 unassigned places
- [x] Click "Generate Itinerary"
- [x] Wait ~5 seconds
- [x] Verify places move from Unassigned → Day 1/2/3
- [x] Verify they are ordered logically (nearby places together)
- [x] Single unassigned place can be assigned to nearest existing day

**Completed Features:**
- [COMPLETED] Fully deterministic itinerary generation (no AI required)
- [COMPLETED] Improved k-means clustering with k-means++ initialization
- [COMPLETED] Route optimization using greedy nearest-neighbor algorithm
- [COMPLETED] Single place assignment logic (1-2 unassigned places → nearest day)
- [COMPLETED] Travel time and visit time estimation
- [COMPLETED] Loading states and error handling

---

## Phase 8: AI Chat Assistant (Day 10-12) [COMPLETED]

**Status:** Fully implemented with "Hey Trippee" trigger, non-streaming responses, and Google Places integration

### 8.1 Define AI Tools [COMPLETED]
File: `lib/ai/tools.ts`

**Tools Implemented:**
1. **search_places** - Search for places using Google Places API (New)
2. **get_place_info** - Get detailed information about a specific place

**search_places Tool:**
- Uses Google Places API (New) via `/api/places/search` endpoint
- Absolute URL support for server-side AI execution
- Default limit of 3 results
- Enhanced description to clarify query can include location and category
- TypeScript type safety with explicit Zod schema typing
- Duplicate filtering (checks existing places in trip)

**get_place_info Tool:**
- Searches Google Places API first for place name (uses first result)
- Falls back to trip database if place exists in trip
- Returns detailed information: name, address, rating, reviews, website, opening hours, editorial summary
- Handles place name extraction from user messages
- Validates that at least one parameter (placeName, placeId, or tripPlaceId) is provided

### 8.2 Create Chat API Route [COMPLETED]
File: `app/api/trips/[tripId]/chat/route.ts`

**Implementation:** Trip-specific chat endpoint with "Hey Trippee" trigger, non-streaming responses, and dual authentication.

**Key Features:**
- Trip-specific endpoint: `/api/trips/[tripId]/chat`
- "Hey Trippee" trigger (case-insensitive) - AI only activates when message starts with this
- Non-streaming responses (JSON) for reliability
- Dual authentication: Token-based (Authorization header) + cookie-based fallback
- Saves user messages and AI responses to `trip_messages` table
- Handles tool invocations (search_places) with robust result extraction
- Fallback message generation if AI finishes with tool calls but no text
- Expanded system prompt for general trip planning advice (not just place recommendations)

**Model:** `gemini-2.5-flash` (updated from gemini-1.5-flash)

```typescript
import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { searchPlacesTool } from '@/lib/ai/tools';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Check if message starts with "Hey Trippee"
  const latestUserMessage = messages?.filter((m: any) => m.role === 'user').pop();
  if (!latestUserMessage?.content?.toLowerCase().startsWith('hey trippee')) {
    // Save as normal group chat message, return early
    return NextResponse.json({ content: '', toolInvocations: [] });
  }

  const result = await generateText({
    model: google('gemini-2.5-flash'),
    system: `You are a collaborative travel planning assistant helping a group plan their trip. You're part of a group chat where all trip members can see your responses.

## Your Capabilities
- **Place Recommendations**: Use the search_places tool to find locations and add them to the map
- **General Trip Planning**: Provide advice on itinerary structure, timing, logistics, and travel tips
- **Group Coordination**: Help coordinate activities that work for multiple people
- **Local Insights**: Share knowledge about destinations, culture, transportation, and best practices

## Your Behavior
1. **When users ask for places**: Use the search_places tool to find options, then explain your recommendations
2. **When users ask for planning advice**: Provide helpful guidance on:
   - Itinerary structure and day-by-day planning
   - Best times to visit attractions
   - Transportation options and routes
   - Budget tips and cost-saving strategies
   - Local customs and cultural etiquette
   - Weather considerations
   - Packing suggestions
   - Group coordination (scheduling, meeting points, etc.)
3. **Be proactive**: If users seem stuck, offer suggestions or ask clarifying questions
4. **Be conversational**: This is a group chat - address the whole group naturally
5. **Be helpful and concise**: Provide actionable advice without being overwhelming

Remember: You're helping real people plan real trips. Be practical, friendly, and considerate of different travel styles and preferences.`,
    messages,
    tools: {
      search_places: searchPlacesTool,
    },
  });

  return result.toTextStreamResponse();
}
```

### 8.3 Create Group Chat Component [COMPLETED]
File: `components/ai/GroupChat.tsx`

**Features:**
- Group chat UI with user avatars/names
- AI messages clearly labeled (purple theme)
- **Real-time message updates via Supabase Realtime** - Messages from other users appear instantly without refresh
- Message persistence (loads from database)
- Non-streaming AI responses (JSON)
- Auto-add places when AI uses search tool
- "Hey Trippee" trigger - AI only activates when message starts with this
- Normal group chat for messages without trigger
- Custom useChat hook (replaced ai/react due to build issues)
- Profile loading with RLS support
- Category mapping for Google Places results
- Robust validation for place data before creation
- **Realtime subscription using postgres_changes** - Requires migration `017_enable_realtime_trip_messages.sql` to enable Realtime on `trip_messages` table
- **Simplified AI messages** - AI says "added to itinerary" instead of "added to itinerary on the right"
- **Mobile full-screen layout** - Chat takes full screen on mobile with dark overlay backdrop

**Implementation:**
```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { useChat } from 'ai/react';
import { createPlace } from '@/lib/supabase/client';

interface Message {
  id: string;
  user_id: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system';
  created_at: string;
  profiles?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface GroupChatProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function GroupChat({ tripId, isOpen, onClose }: GroupChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `/api/trips/${tripId}/chat`,
    onFinish: async (message) => {
      // Save AI response to database
      await supabase.from('trip_messages').insert({
        trip_id: tripId,
        user_id: null, // AI message
        content: message.content,
        role: 'assistant',
      });

      // Check for tool calls (place additions)
      if (message.toolInvocations) {
        for (const invocation of message.toolInvocations) {
          if (invocation.toolName === 'search_places' && invocation.result?.results) {
            // Auto-add places to map
            for (const place of invocation.result.results.slice(0, 3)) {
              await createPlace({
                trip_id: tripId,
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                category: place.category || 'other',
                created_by: user?.id || null,
              });
            }
          }
        }
      }
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`trip-messages:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trip_messages',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          loadMessageWithProfile(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [isOpen, tripId]);

  async function loadMessages() {
    const { data } = await supabase
      .from('trip_messages')
      .select(`
        *,
        profiles(id, full_name, email)
      `)
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
    setLoading(false);
    scrollToBottom();
  }

  async function loadMessageWithProfile(message: Message) {
    if (message.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', message.user_id)
        .single();

      message.profiles = profile || undefined;
    }
    setMessages((prev) => [...prev, message]);
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !user) return;

    handleSubmit(e);
  }

  function getSenderName(message: Message): string {
    if (message.role === 'assistant') return 'AI Assistant';
    if (message.profiles?.full_name) return message.profiles.full_name;
    if (message.profiles?.email) return message.profiles.email.split('@')[0];
    return 'Unknown User';
  }

  function getSenderInitials(message: Message): string {
    if (message.role === 'assistant') return 'AI';
    const name = getSenderName(message);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  if (!isOpen) return null;
  
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">Trip Chat</h2>
          <p className="text-sm text-gray-600">Collaborate with your group</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-700 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-600">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-600">
            <p className="mb-2">Start the conversation!</p>
            <p className="text-sm">Ask the AI assistant for place recommendations.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.user_id === user?.id ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                  message.role === 'assistant'
                    ? 'bg-purple-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}
              >
                {getSenderInitials(message)}
              </div>

              {/* Message Content */}
              <div className={`flex-1 ${message.user_id === user?.id ? 'items-end' : ''}`}>
                <div className="text-xs text-gray-600 mb-1">
                  {getSenderName(message)}
                </div>
                <div
                  className={`rounded-lg p-3 ${
                    message.role === 'assistant'
                      ? 'bg-purple-50 border border-purple-200'
                      : message.user_id === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
                  <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(message.created_at).toLocaleTimeString()}
          </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-semibold">
              AI
            </div>
            <div className="flex-1">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t">
        <div className="flex gap-2">
        <input
          value={input}
            onChange={handleInputChange}
            placeholder="Ask for recommendations..."
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
        />
        <button
          type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
            Send
        </button>
        </div>
      </form>
    </div>
  );
}
```

**Testing:**
- [x] Open chat in trip with multiple members
- [x] Send message, verify it appears for all members in real-time (via Supabase Realtime)
- [x] Ask AI "Hey Trippee, find 3 coffee shops", verify places auto-added to map
- [x] Verify AI response appears in chat with proper formatting
- [x] Test with single member (just them and AI)
- [x] Verify message history persists after page refresh
- [x] Verify "Hey Trippee" trigger works (case-insensitive)
- [x] Verify normal messages (without trigger) are saved as group chat
- [x] Verify user names display correctly (not "Unknown user")
- [x] Verify realtime subscription works (messages from other users appear instantly)
- [x] Verify migration `017_enable_realtime_trip_messages.sql` is applied to enable Realtime

### 8.4 Create Group Chat API Route & Auto-Add Places [COMPLETED]
File: `app/api/trips/[tripId]/chat/route.ts`

**Features:**
- Trip-specific chat endpoint (already covered in 8.2)
- Loads message history from database
- Handles tool calls (search_places)
- Returns tool results in format client expects
- Saves user messages to database
- Dual authentication strategy
- RLS policy support for trip_messages

**Implementation:**
```typescript
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { searchPlacesTool } from '@/lib/ai/tools';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is trip member
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .single();

  if (!trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  const { messages: requestMessages } = await request.json();

  // Extract the latest user message to save to database
  const latestUserMessage = requestMessages
    ?.filter((m: any) => m.role === 'user')
    .pop();

  if (latestUserMessage) {
    // Save user message to database
    const { error: msgError } = await supabase
      .from('trip_messages')
      .insert({
      trip_id: tripId,
        user_id: user.id,
        content: latestUserMessage.content,
        role: 'user',
      } as any);

    if (msgError) {
      console.error('Failed to save user message:', msgError);
      // Continue anyway - don't block the AI response
    }
  }

  // Use messages from request (useChat sends the full conversation)
  // Convert to AI SDK format
  const messages = (requestMessages || []).map((msg: any) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    content: msg.content,
  }));

  // Get trip places for context
  const { data: places } = await supabase
    .from('places')
    .select('id, name, lat, lng, category')
    .eq('trip_id', tripId);

  // Generate AI response with tool support
  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: `You are a collaborative travel planning assistant helping a group plan their trip. You're part of a group chat where all trip members can see your responses.

Context:
- Trip ID: ${tripId}
- Current places on map: ${places?.length || 0}
- You can search for places and add them to the map

When users ask for recommendations:
1. Use the search_places tool to find options
2. Explain your recommendations
3. Be conversational and helpful
4. Remember this is a group chat - address the whole group naturally

If you add places to the map, mention them in your response.`,
    messages,
    tools: {
      search_places: searchPlacesTool,
    },
  });

  return result.toTextStreamResponse();
}
```

**Client-side auto-add logic (already in GroupChat.tsx):**
The `onFinish` handler in `GroupChat.tsx` automatically:
1. Saves AI response to database
2. Checks for `toolInvocations` in the message
3. If `search_places` tool was used, extracts `result.results`
4. Auto-adds top 3 places to the map via `createPlace()`

**Testing:**
- [x] Ask AI "Hey Trippee, find 3 coffee shops in Shibuya"
- [x] Verify AI calls search_places tool
- [x] Verify places auto-appear on map after AI responds
- [x] Verify AI mentions the places in chat response
- [x] Verify all trip members see the new places in real-time
- [x] Verify category mapping works (Google categories → database categories)
- [x] Verify invalid place data is filtered out

---

## Phase 8.5: Trip Sharing & Invitations (Day 12-13) [COMPLETED]

**Status:** Fully implemented with RLS policy fixes for invitation acceptance

### 8.5.1 Create Invite API Route [COMPLETED]
File: `app/api/trips/[tripId]/invite/route.ts`

**Status:** Fully implemented with email sending via Resend

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { tripId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await request.json();

  // Verify user is trip owner
  const { data: trip } = await supabase
    .from('trips')
    .select('id, created_by')
    .eq('id', params.tripId)
    .single();

  if (!trip || trip.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Check if user already exists
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('trip_invitations')
    .insert({
      trip_id: params.tripId,
      email,
      invited_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send email with invitation link using Resend
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: email,
    subject: `You've been invited to collaborate on ${trip.name}`,
    html: getInvitationEmailHTML(trip.name, inviterName, inviteLink),
  });

  return NextResponse.json({
    invitation,
    inviteLink: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invitation.token}`,
  });
}
```

### 8.5.2 Create Invite Acceptance Page
File: `app/invite/[token]/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function InvitePage({ params }: { params: { token: string } }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitation();
  }, []);

  async function loadInvitation() {
    const { data, error } = await supabase
      .from('trip_invitations')
      .select('*, trips(*)')
      .eq('token', params.token)
      .eq('status', 'pending')
      .single();

    if (error || !data) {
      setError('Invalid or expired invitation');
      setLoading(false);
      return;
    }

    setInvitation(data);
    setLoading(false);
  }

  async function handleAccept() {
    if (!user) {
      // Redirect to sign in, then back to invite
      router.push(`/auth?redirect=/invite/${params.token}`);
      return;
    }

    setLoading(true);

    // Add user to trip_members
    const { error: memberError } = await supabase
      .from('trip_members')
      .insert({
        trip_id: invitation.trip_id,
        user_id: user.id,
        role: 'member',
        invited_by: invitation.invited_by,
      });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    // Update invitation status
    await supabase
      .from('trip_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    // Redirect to trip
    router.push(`/trip/${invitation.trip_id}`);
  }

  if (loading || authLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Trip Invitation</h1>
        <p className="text-gray-600 mb-6">
          You've been invited to collaborate on: <strong>{invitation?.trips?.name}</strong>
        </p>
    <button
          onClick={handleAccept}
          className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
    >
          {user ? 'Accept Invitation' : 'Sign In to Accept'}
    </button>
      </div>
    </div>
  );
}
```

### 8.5.3 Dashboard Invites Tab [COMPLETED]
File: `app/dashboard/page.tsx`

**Features:**
- Tabbed interface with "My Trips" and "Invites" tabs
- Notification badge showing count of pending invitations
- List of pending invitations with trip details and inviter information
- Accept button adds user to trip and refreshes trips list
- Decline button updates invitation status
- Optimistic UI updates for instant feedback
- Client-side Supabase queries for proper authentication

**Implementation:**
- Added `activeTab` state ('trips' | 'invites')
- `loadInvites()` function fetches pending invitations for user's email
- Fetches trip details and inviter profiles separately to avoid RLS issues
- Accept/decline handlers use client-side Supabase for proper session access
- Auto-refreshes trips list after accepting invitation

**Testing:**
- [x] Invites tab shows pending invitations sent to user's email
- [x] Notification badge displays correct count
- [x] Accept button adds user to trip and updates invitation status
- [x] Decline button updates invitation status
- [x] Optimistic updates work correctly
- [x] Trips list refreshes after accepting invitation

### 8.5.4 Add Share Button to Trip Page
File: `components/trip/ShareButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function ShareButton({ tripId }: { tripId: string }) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const response = await fetch(`/api/trips/${tripId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 2000);
    } else {
      alert(data.error);
    }

    setLoading(false);
  }
  
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Share Trip
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Invite Collaborator</h2>
            <form onSubmit={handleInvite}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border p-2 rounded mb-4"
                required
              />
              {success && (
                <p className="text-green-500 text-sm mb-4">Invitation sent!</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border p-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-500 text-white p-2 rounded"
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
    </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
```

**Testing:**
- [x] Trip owner can invite user by email
- [x] Invited user receives invitation link
- [x] User can accept invitation (creates trip_member record)
- [x] User is redirected to trip page after accepting
- [x] Invited user can see and edit trip places
- [x] Multiple users can collaborate on same trip in real-time

**Completed Features:**
- [COMPLETED] Invite API route with dual authentication
- [COMPLETED] Invitation acceptance page with sign-in redirect
- [COMPLETED] ShareButton component integrated into trip page
- [COMPLETED] RLS policy fixes for invitation acceptance (migration 008)
- [COMPLETED] Users with pending invitations can read trip information
- [COMPLETED] Users can view profiles of other trip members (for chat display)
- [COMPLETED] SECURITY DEFINER helper functions to avoid RLS recursion
- [COMPLETED] Email invitations with themed HTML templates (Original Surfer font)
- [COMPLETED] Email templates match website design system (theme colors)
- [COMPLETED] **Dashboard Invites Tab** - Users can view and manage pending invitations in dashboard
- [COMPLETED] **Invite Management UI** - Accept/decline buttons with optimistic updates
- [COMPLETED] **RLS Policies for Invitations** - Migration 018 adds proper RLS for trip_invitations table

---

## Phase 9: User Dashboard & Trip Management (Day 13-14) [COMPLETED]

**Status:** Fully implemented with trip creation, listing, and navigation

### 9.1 Create Dashboard Page
File: `app/dashboard/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
      return;
    }
    if (user) {
      loadTrips();
    }
  }, [user, authLoading]);

  async function loadTrips() {
    // Get trips user owns or is a member of
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        trip_members!inner(user_id),
        profiles!trips_created_by_fkey(id, email, full_name)
      `)
      .or(`created_by.eq.${user?.id},trip_members.user_id.eq.${user?.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      setTrips(data);
    }
    setLoading(false);
  }

  async function handleCreateTrip() {
    if (!user) return;

    const { data, error } = await supabase
      .from('trips')
      .insert({
        name: 'New Trip',
        created_by: user.id,
      })
      .select()
      .single();

    if (data) {
      router.push(`/trip/${data.id}`);
    }
  }

  if (authLoading || loading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Trips</h1>
          <button
            onClick={handleCreateTrip}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + Create New Trip
          </button>
      </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trip/${trip.id}`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{trip.name}</h2>
              <p className="text-gray-500 text-sm mb-4">
                Created by {trip.profiles?.full_name || trip.profiles?.email}
              </p>
              <div className="text-sm text-gray-400">
                {new Date(trip.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>

        {trips.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No trips yet</p>
            <button
              onClick={handleCreateTrip}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Your First Trip
            </button>
        </div>
      )}
    </div>
    </div>
  );
}
```

### 9.2 Update Landing Page
File: `app/page.tsx`

**Features:**
- Show "Sign In" / "Dashboard" buttons based on auth state
- "Create Trip" button redirects to dashboard if logged in
- Hero section with app description

### 9.3 Add Navigation Header
File: `components/layout/Header.tsx`

```typescript
'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const { user, loading } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/');
  }

      return (
    <header className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-2xl font-bold">
          Trippee
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                Dashboard
              </Link>
          <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900"
          >
                Sign Out
          </button>
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
                {user.email?.[0].toUpperCase()}
        </div>
            </>
          ) : (
            <Link
              href="/auth"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
```

**Testing:**
- [x] User can see all their trips on dashboard
- [x] User can create new trip from dashboard
- [x] User can navigate to trip from dashboard
- [x] Header shows user info when logged in
- [x] Sign out works correctly

**Completed Features:**
- [COMPLETED] Dashboard page with trip listing
- [COMPLETED] Trip creation with automatic trip_members entry
- [COMPLETED] Profile creation check (creates if missing)
- [COMPLETED] Separate queries for owned and member trips (avoids RLS recursion)
- [COMPLETED] Header component with auth state
- [COMPLETED] Landing page redirects to dashboard if authenticated
- [COMPLETED] Improved text readability (fixed grey text issues)
- [COMPLETED] Trip deletion/leaving functionality (3-dot menu on trip cards)
- [COMPLETED] Trip rename functionality (accessible via 3-dot menu)
- [COMPLETED] Original creator display ("Created by you" or creator name)
- [COMPLETED] Host indicator ("Host: you" when user is current owner)
- [COMPLETED] Ownership transfer when owner leaves (automatic, transfers to oldest member)
- [COMPLETED] Trip deletion when owner is the only member (automatic)
- [COMPLETED] Header shows user full name and conditional Dashboard link

---

## Phase 9.5: Trip Deletion & Ownership Management (Day 14-15) [COMPLETED]

**Status:** Fully implemented with ownership transfer and original creator tracking

### 9.5.1 Trip Deletion & Leaving Functionality [COMPLETED]
**Features:**
- Users can leave trips via 3-dot menu on dashboard trip cards
- Trip owners can delete trips (if they're the only member)
- When owner leaves, ownership automatically transfers to oldest member
- When owner is the only member and leaves, trip is automatically deleted
- PostgreSQL trigger function handles ownership transfer logic

**Implementation:**
- Migration `010_allow_trip_deletion.sql`:
  - `handle_owner_removal()` trigger function
  - RLS policy for users to remove themselves from trip_members
  - RLS policy for trip owners to delete trips
- Dashboard 3-dot menu with "Leave Trip" option for all members
- Dashboard 3-dot menu with "Rename" option for trip owners

**Testing:**
- [x] User can leave a trip they're a member of
- [x] When owner leaves, ownership transfers to oldest member
- [x] When owner is the only member and leaves, trip is deleted
- [x] Trip no longer appears on dashboard after leaving

### 9.5.2 Original Creator Tracking [COMPLETED]
**Features:**
- Track original trip creator even after ownership transfers
- Dashboard shows "Created by you" if user is original creator
- Dashboard shows "Created by [name]" for original creator
- Dashboard shows "Host: you" if user is current owner (separate from creator)
- Original creator profile visible even if they've left the trip

**Implementation:**
- Migration `011_add_original_creator.sql`:
  - Added `original_created_by` column to trips table
  - Trigger to set `original_created_by` on trip creation
  - Updated `handle_owner_removal()` to preserve `original_created_by`
- Migration `012_allow_viewing_original_creator_profile.sql`:
  - Updated `are_trip_members_together()` function to allow viewing original creator profiles
  - Allows trip members to see original creator's name even if they've left
- Dashboard updated to fetch and display original creator profiles
- Dashboard display logic distinguishes between original creator and current host

**Testing:**
- [x] Original creator is tracked when trip is created
- [x] Original creator name persists after ownership transfer
- [x] Dashboard shows "Created by you" for original creator
- [x] Dashboard shows "Host: you" for current owner
- [x] New host can see original creator's name even if they've left

### 9.5.3 Dashboard UI Improvements [COMPLETED]
**Features:**
- 3-dot menu on trip cards for actions (Rename, Leave Trip)
- Conditional menu options (Rename only for owners, Leave Trip for all)
- Click outside to close menu
- Trip rename modal
- Header improvements (user full name, conditional Dashboard link)

**Testing:**
- [x] 3-dot menu appears on hover/click
- [x] Menu closes when clicking outside
- [x] Rename option only visible to trip owners
- [x] Leave Trip option visible to all members
- [x] Trip name updates after rename

---

## Phase 10: Polish & Deployment (Day 14-16) [IN PROGRESS]

**Status:** Most polish items completed, deployment pending

## Phase 10.6: Collaborative Notes Feature (NEW) [COMPLETED]

**Status:** Fully implemented with real-time collaborative editing using Tiptap and Supabase Realtime

### 10.6.1 Database Schema for Notes [COMPLETED]
**Migrations:** `015_create_notes_table.sql`, `019_add_day_notes.sql`

**Features:**
- `notes` table with `id`, `trip_id`, `place_id` (nullable), `day_number` (nullable), `content` (JSONB), `created_at`, `updated_at`
- Unique constraint using partial indexes:
  - One general note per trip (`place_id IS NULL AND day_number IS NULL`)
  - One note per place per trip (`place_id IS NOT NULL AND day_number IS NULL`)
  - One note per day per trip (`place_id IS NULL AND day_number IS NOT NULL`)
- Check constraint ensures notes are either for a place, a day, or general (not both place and day)
- RLS policies for trip members (SELECT, INSERT, UPDATE)
- Cascade delete when trip or place is deleted

### 10.6.2 Notes UI Components [COMPLETED]
**Files:**
- `app/trip/[tripId]/notes/page.tsx` - Notes page route
- `components/notes/NotesLayout.tsx` - Split view layout (sidebar + editor) with mobile drawer
- `components/notes/NotesSidebar.tsx` - List of places and "General Trip Notes"
- `components/notes/NotesEditor.tsx` - Tiptap editor with real-time collaboration

**Features:**
- **Desktop:** Two-column layout: Sidebar (places list) + Editor (rich text)
- **Mobile:** Side drawer from right with all notes, full-screen editor with header
- Sidebar groups places by day, highlights selected place/note
- "General Trip Notes" option (place_id = null, day_number = null)
- **Day Notes** - Each day has its own notes section (day_number set, place_id = null)
- Tiptap rich text editor with StarterKit (headings, lists, bold, italic, etc.)
- Real-time collaboration using Supabase Realtime broadcast
- Presence tracking (shows who else is editing)
- Debounced saving (1 second after typing stops)
- Loading states and connection status indicator
- "Back to Trip" button in sidebar header (desktop) and mobile header
- Editor remounts when switching between notes (key prop)
- **Mobile header** shows current note title with icon (General, Day X, or Place name)
- **Mobile drawer** automatically closes when note is selected

### 10.6.3 Real-Time Collaboration [COMPLETED]
**Implementation:**
- Uses Supabase Realtime broadcast channels (not Y.js)
- Channel name: `notes:${tripId}:${placeId || 'general'}`
- Broadcasts content updates when user types
- Receives updates from other users and applies to editor
- Presence tracking shows other users editing the same note
- Prevents saving during content loading
- Tracks note ID for update vs insert logic

**Testing:**
- [x] Multiple users can edit same note simultaneously
- [x] Changes appear in real-time for all users
- [x] Presence indicator shows who else is editing
- [x] Notes persist after page refresh
- [x] General trip notes save correctly
- [x] Place-specific notes save correctly
- [x] Switching between places loads correct content

### 10.6.4 PDF Download Integration [COMPLETED]
**File:** `app/api/trips/[tripId]/download/route.ts`

**Features:**
- Fetches notes from `notes` table (general, place-specific, and day notes)
- Extracts plain text from Tiptap JSONB content
- Adds general trip notes to top of PDF
- Adds day notes after each day header in itinerary
- Adds place-specific notes below each place in itinerary
- Handles empty notes gracefully
- Notes appear in italic style with "Notes:" prefix

**Testing:**
- [x] General trip notes appear at top of PDF
- [x] Day notes appear after each day header
- [x] Place-specific notes appear below each place
- [x] Empty notes don't break PDF generation
- [x] Plain text extraction works correctly

### 10.6.5 Day Notes Feature [COMPLETED]
**Status:** Fully implemented with day note previews in itinerary panel

**Features:**
- Day notes can be created for each day in the itinerary
- Notes sidebar shows "Day X Notes" button under each day heading
- Itinerary panel displays first few words of day notes beside "Day X" header
- Preview text is truncated with ellipsis and shows full text on hover
- Day notes are included in PDF download after each day header
- Real-time collaboration works for day notes (same as place notes)

**Implementation:**
- Migration `019_add_day_notes.sql` adds `day_number` column to notes table
- Partial unique indexes ensure one note per day per trip
- NotesSidebar updated to show day notes as selectable items
- NotesEditor handles day notes (day_number set, place_id = null)
- ItineraryPanel fetches and displays day note previews
- Download route includes day notes in PDF generation

**Testing:**
- [x] Day notes can be created and edited
- [x] Day note previews appear in itinerary panel
- [x] Day notes are included in PDF download
- [x] Real-time collaboration works for day notes
- [x] Switching between day notes loads correct content

## Phase 10.7: UI Improvements & Floating Dock (NEW) [COMPLETED]

**Status:** Fully implemented with theme-consistent design

### 10.7.1 Floating Dock Component [COMPLETED]
**File:** `components/ui/floating-dock.tsx`

**Features:**
- Floating dock at bottom of map (centered from left edge to itinerary panel)
- Uses `@aceternity/floating-dock` component
- Theme-consistent styling (CSS variables)
- Independent hover states for each icon
- Tooltips show on hover
- Icons: Download, Settings, Open Chat, Share Trip, Trip Members, Notes
- Smooth animations using Framer Motion

### 10.7.2 Trip Members Modal [COMPLETED]
**File:** `components/trip/TripMembersModal.tsx`

**Features:**
- Displays all trip members with names/emails
- Shows current host (created_by)
- Shows original creator (original_created_by)
- Highlights current user
- Fetches profiles for all members
- Handles cases where host might not be in trip_members table
- RLS policy allows all members to view all other members

### 10.7.3 Header Improvements [COMPLETED]
**File:** `components/layout/Header.tsx`

**Features:**
- Displays trip name when on trip page
- Shows user full name
- Conditional Dashboard link (only on trip pages, not on dashboard)
- Dashboard link positioned to right of full name
- Theme-consistent styling (dark background with light text)

### 10.7.4 Itinerary Place Cards [COMPLETED]
**File:** `components/itinerary/ItineraryPanel.tsx`

**Features:**
- "Open on Google Maps" link on each place card
- Uses `place_id` for Google Maps URL if available, falls back to lat/lng
- Link prevents drag functionality (stopPropagation)
- Entire card is draggable except link and menu button
- Theme-consistent link styling

### 10.7.5 Map Improvements [COMPLETED]
**File:** `components/map/MapView.tsx`

**Features:**
- Map centered from left edge to left edge of itinerary panel
- Google Maps-style pin markers with theme colors
- All user cursors use primary brown color (consistent theme)
- Search bar positioned below header (z-index fixes)

## Phase 10.8: Mobile-First Responsive Design (NEW) [COMPLETED]

**Status:** Fully implemented with comprehensive mobile adaptations while preserving desktop layout

### 10.8.1 Global Header Mobile Adaptation [COMPLETED]
**File:** `components/layout/Header.tsx`

**Features:**
- Reduced padding on mobile (`px-2 py-2` vs desktop `px-4 py-4`)
- Smaller logo text (`text-2xl` on mobile vs `text-3xl` on desktop)
- Truncated trip name with ellipsis on mobile
- Hidden user name and dashboard link on mobile
- Icon-only sign-out button on mobile (replaces text)
- Desktop layout completely unchanged

### 10.8.2 Itinerary Panel Mobile Drawer [COMPLETED]
**File:** `components/itinerary/ItineraryPanel.tsx`

**Features:**
- Hidden by default on mobile, slides in from right when opened
- Floating toggle button (list icon) in top-right corner on mobile
- Full-screen overlay backdrop when drawer is open
- Generate Itinerary button and reset checkbox moved above Unassigned section (mobile only)
- Desktop layout unchanged (fixed sidebar always visible)
- Smooth slide-in/out animations

### 10.8.3 Floating Dock Mobile Positioning [COMPLETED]
**File:** `components/ui/floating-dock.tsx`

**Features:**
- Centered horizontally at bottom of screen on mobile (`bottom-4 left-1/2 -translate-x-1/2`)
- Desktop positioning unchanged (centered from left edge to itinerary panel)
- Touch-friendly spacing for mobile thumb access

### 10.8.4 MapView Mobile Layout [COMPLETED]
**File:** `components/map/MapView.tsx`

**Features:**
- Full viewport width and height on mobile (`w-full h-screen`)
- Adjusted width on desktop to account for itinerary panel (`calc(100% - 320px)`)
- SearchBar full-width on mobile (removed `max-w-md` constraint)

### 10.8.5 GroupChat Mobile Layout [COMPLETED]
**File:** `components/ai/GroupChat.tsx`

**Features:**
- Full-screen overlay on mobile (`w-full`)
- Dark backdrop overlay when open on mobile
- Desktop layout unchanged (384px sidebar)
- Close button with increased padding for easier tapping

### 10.8.6 Notes Page Mobile UI [COMPLETED]
**File:** `components/notes/NotesLayout.tsx`

**Features:**
- **Mobile Header:** Fixed top header with back button, current note title with icon, and menu button
- **Side Drawer:** Slides in from right (85% width) with all notes (General, Day notes, Place notes)
- **Full-Screen Editor:** Editor takes full screen below header, shows current note context
- **Desktop Layout:** Unchanged two-column layout (sidebar + editor)
- Drawer automatically closes when note is selected
- Current note title dynamically updates (General Trip Notes, Day X Notes, or Place name)

**Testing:**
- [x] All components adapt correctly to mobile breakpoints
- [x] Desktop layouts remain unchanged
- [x] Touch interactions work smoothly
- [x] Drawers and overlays function correctly
- [x] No layout shifts or overflow issues

## Phase 10.5: Trip Settings & Customization (NEW) [IN PROGRESS]

### 10.5.1 Create Trip Settings Menu
**Features:**
- Trip settings button/menu accessible from trip page
- Modal/drawer with trip customization options
- Trip start date field (date picker)
- Trip end date field (date picker)
- Dynamic calculation of trip days based on date range
- Update `start_date` and `end_date` in database when dates change
- Calculate `trip_days` automatically from date range
- Validation: end date must be after start date
- Only trip owners can edit settings

**Implementation:**
- Create `components/trip/TripSettingsModal.tsx`
- Add settings button (gear icon) to trip page header
- Use HTML5 date inputs for date selection
- Calculate days: `Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1`
- Update trip via Supabase `update()` call

### 10.5.2 Update Itinerary Generation
**Changes:**
- Fetch trip data including `start_date`, `end_date`, `trip_days`
- Use `trip_days` from trip data (not hardcoded)
- K-means clustering uses calculated number of days from trip settings
- Pass `tripDays` prop to `ItineraryPanel` component
- Update API route to accept `tripDays` from request body

**Files to Update:**
- `app/trip/[tripId]/page.tsx`: Fetch trip data, pass tripDays to components
- `app/api/ai/generate-itinerary/route.ts`: Already accepts tripDays, no changes needed
- `components/itinerary/ItineraryPanel.tsx`: Use tripDays prop to render day columns

### 10.5.3 Update UI Components
**Changes:**
- ItineraryPanel: Dynamically render day columns based on `tripDays` prop (1 to 14 days)
- Show trip duration in settings modal
- Display start/end dates in trip header (optional)
- Settings button only visible to trip owners

**Testing:**
- [ ] Trip owner can open settings modal
- [ ] Can set start and end dates
- [ ] Days are calculated correctly
- [ ] Itinerary panel shows correct number of day columns
- [ ] AI itinerary generation uses correct number of days
- [ ] Non-owners cannot see/edit settings

### 10.1 Add Loading States [COMPLETED]
**Locations:**
- [x] Map loading: Show skeleton map with spinner
- [x] AI generation: Disable button, show loading spinner
- [x] Place creation: Optimistic update (show pin immediately, fade if fails)
- [x] Chat loading: Loading state for messages
- [x] Dashboard loading: Loading state for trips

### 10.2 Error Handling [COMPLETED]
**Scenarios:**
- [x] AI rate limit hit: Error handling in API route
- [x] Network failure: Error handling in components
- [x] Invalid trip ID: Redirect to 404 page
- [x] Authentication errors: Proper 401/403 handling
- [x] RLS policy errors: Fixed with SECURITY DEFINER functions
- [x] Empty AI responses: Fallback message generation
- [x] Invalid place data: Validation and filtering

### 10.3 Mobile Responsiveness [COMPLETED]
**Status:** Fully implemented with mobile-first design while preserving desktop layout

**Changes:**
- [x] Fixed positioning to prevent scrolling issues
- [x] Search bar z-index fixes
- [x] Button positioning adjustments
- [x] **Header mobile adaptation** - Reduced padding, smaller logo, truncated trip name, icon-only sign-out button
- [x] **Itinerary Panel mobile drawer** - Slides in from right, hidden by default, toggle button, full-screen overlay backdrop
- [x] **Floating Dock mobile positioning** - Centered horizontally at bottom of screen on mobile
- [x] **MapView mobile layout** - Full viewport width and height on mobile, adjusted width on desktop
- [x] **SearchBar mobile layout** - Full-width on mobile (removed max-width constraint)
- [x] **GroupChat mobile layout** - Full-screen on mobile with dark overlay backdrop
- [x] **Notes page mobile UI** - Side drawer from right with all notes, full-screen editor with header showing current note
- [x] **Generate Itinerary button** - Moved above Unassigned section in itinerary panel for mobile only

**Mobile-Specific Features:**
- Itinerary panel: Hidden by default, accessible via floating icon button
- Notes sidebar: Drawer slides from right, shows all notes (General, Day notes, Place notes)
- Notes editor: Full-screen with header showing current note title and icon
- Chat: Full-screen overlay on mobile
- Floating dock: Centered at bottom for easy thumb access
- All desktop layouts preserved (no changes to screens > 640px)

**Testing:** 
- [x] Desktop layout works correctly (unchanged)
- [x] Mobile layout tested with responsive design tools
- [x] All components adapt correctly to mobile breakpoints

### 10.4 Add Landing Page [COMPLETED]
File: `app/page.tsx`

**Features:**
- [x] Hero section: "Plan Trips Together with AI"
- [x] "Create New Trip" button → redirects to dashboard or sign-in
- [x] Redirects to dashboard if user is authenticated
- [x] Auth modal integration
- [ ] Example screenshot/video - TODO

### 10.5 Deploy to Vercel [PENDING]
```bash
npm run build  # Verify no errors
git init
git add .
git commit -m "Initial commit"
gh repo create trippee --public --source=. --push
```

In Vercel Dashboard:
1. Import GitHub repo
2. Add environment variables (Mapbox, Supabase, Google AI)
3. Deploy

**Testing:**
- Visit production URL
- Create trip, add places, generate itinerary
- Share link with friend, verify real-time sync works

### 10.6 Create README [PENDING]
File: `README.md`

**Sections:**
- What is Trippee?
- Features
- Tech Stack
- Setup Instructions
- Environment Variables
- Deployment
- Database Migrations

---

## Additional Improvements Made

### UI/UX Enhancements
- [COMPLETED] Collapsible "Unassigned" section in itinerary panel (max-height with scroll)
- [COMPLETED] 3-dot menu on itinerary places for quick edit/delete
- [COMPLETED] Improved text readability (fixed grey text issues across all components)
- [COMPLETED] Fixed button positioning (chat/share buttons beside search bar)
- [COMPLETED] Fixed scrolling issues (map and search bar stay fixed)
- [COMPLETED] Better placeholder text and input styling
- [COMPLETED] Trip deletion/leaving functionality with 3-dot menu on dashboard trip cards
- [COMPLETED] Trip rename functionality accessible via 3-dot menu
- [COMPLETED] Dashboard shows "Created by you" if user is original creator, "Host: you" if user is current owner
- [COMPLETED] Header shows user full name and conditional Dashboard link (only on trip pages)
- [COMPLETED] Removed footer component, minimal "Made by" text in bottom-right corner of landing page
- [COMPLETED] Email templates use Original Surfer font matching website header

### Technical Improvements
- [COMPLETED] Fully deterministic itinerary generation (k-means clustering + route optimization, no AI)
- [COMPLETED] Improved k-means clustering algorithm (k-means++ initialization, empty cluster handling)
- [COMPLETED] Single place assignment logic (1-2 unassigned places → nearest existing day)
- [COMPLETED] Google Places API (New) integration (replaced Mapbox Geocoding)
- [COMPLETED] Category mapping for Google Places results
- [COMPLETED] Custom useChat hook (replaced ai/react due to build issues)
- [COMPLETED] Non-streaming AI responses for reliability
- [COMPLETED] Dual authentication strategy (token + cookie-based)
- [COMPLETED] SECURITY DEFINER helper functions to avoid RLS recursion
- [COMPLETED] Real-time place updates via Supabase Realtime postgres_changes
- [COMPLETED] Custom event fallback for place creation
- [COMPLETED] Robust validation for place data
- [COMPLETED] Profile viewing for trip members (RLS policy updates)
- [COMPLETED] Trip ownership transfer system (automatic when owner leaves, transfers to oldest member)
- [COMPLETED] Original creator tracking (original_created_by field preserved during ownership transfers)
- [COMPLETED] RLS policy for viewing original creator profiles (even after they leave the trip)
- [COMPLETED] PostgreSQL trigger functions for automatic ownership transfer and trip deletion
- [COMPLETED] Email template theming with Google Fonts (Original Surfer) integration
- [COMPLETED] **Collaborative notes with Tiptap** - Real-time rich text editing using Supabase Realtime broadcast
- [COMPLETED] **Day notes feature** - Notes for each day in itinerary with previews in itinerary panel
- [COMPLETED] **get_place_info AI tool** - Detailed place information retrieval from Google Places API
- [COMPLETED] **Real-time chat updates** - Messages from other users appear instantly via Supabase Realtime postgres_changes
- [COMPLETED] **Floating dock UI** - Theme-consistent action buttons using @aceternity/floating-dock
- [COMPLETED] **Trip members modal** - View all trip members with host/creator indicators
- [COMPLETED] **PDF download with notes** - General, day-specific, and place-specific notes included in itinerary PDF
- [COMPLETED] **Dashboard Invites Tab** - View and manage pending trip invitations with accept/decline actions
- [COMPLETED] **Deterministic itinerary generation** - Removed AI dependency, uses pure k-means clustering and route optimization
- [COMPLETED] **Mobile-first responsive design** - Full mobile adaptation for all components while preserving desktop layout
- [COMPLETED] **Mobile Notes UI** - Side drawer navigation with full-screen editor and header showing current note
- [COMPLETED] **Mobile Itinerary Panel** - Slide-in drawer from right with toggle button
- [COMPLETED] **Mobile Chat** - Full-screen overlay with dark backdrop
- [COMPLETED] **AI chat message improvements** - Simplified messages (removed "on the right" references)

### Database Migrations
- [COMPLETED] `001_auth_schema.sql` - Initial schema with auth, profiles, trips, places, trip_members, trip_invitations
- [COMPLETED] `002_trip_messages_rls.sql` - RLS policies for chat messages
- [COMPLETED] `003_add_creators_to_trip_members.sql` - Backfill trip creators as members
- [COMPLETED] `006_fix_trip_creation_rls.sql` - Fix handle_new_user trigger permissions
- [COMPLETED] `007_remove_get_user_email_function.sql` - Remove problematic function
- [COMPLETED] `008_allow_invitation_acceptance.sql` - Allow invitation acceptance, profile viewing, and trip reading for pending invitations
- [COMPLETED] `009_add_trip_dates.sql` - Add start_date and end_date fields to trips table
- [COMPLETED] `010_allow_trip_deletion.sql` - Allow users to leave trips, ownership transfer when owner leaves, trip deletion if owner is last member
- [COMPLETED] `011_add_original_creator.sql` - Add original_created_by field to track original trip creator, preserve it during ownership transfers
- [COMPLETED] `012_allow_viewing_original_creator_profile.sql` - Allow trip members to view profiles of original creators even if they've left the trip
- [COMPLETED] `014_allow_members_to_view_all_members.sql` - Allow all trip members to view all other members (for trip members modal)
- [COMPLETED] `015_create_notes_table.sql` - Create notes table with RLS policies for collaborative notes
- [COMPLETED] `016_cleanup_duplicate_notes.sql` - Cleanup script for duplicate notes (if any)
- [COMPLETED] `017_enable_realtime_trip_messages.sql` - Enable Supabase Realtime for trip_messages table (REPLICA IDENTITY FULL + publication)
- [COMPLETED] `018_add_invitations_rls.sql` - RLS policies for trip_invitations table (INSERT, SELECT, UPDATE)
- [COMPLETED] `019_add_day_notes.sql` - Add day_number column to notes table with partial unique indexes for day notes

---

## Testing Checklist (End-to-End)

### Authentication Flows
- [ ] User can sign up with email/password
- [ ] User can sign in with email/password
- [ ] User can sign in with Google OAuth
- [ ] User profile is automatically created on signup
- [ ] User can sign out
- [ ] Protected routes redirect to sign in if not authenticated
- [ ] User session persists across page refreshes

### Trip Management Flows
- [ ] User can create a new trip from dashboard
- [ ] User can see all their trips on dashboard
- [ ] User can navigate to trip from dashboard
- [ ] Trip owner can invite collaborator by email
- [ ] Invited user receives invitation link
- [ ] Invited user can accept invitation and join trip
- [ ] Only trip members can view/edit trip places
- [ ] User can leave a trip (removes them from trip_members)
- [ ] Trip owner can rename their trip
- [ ] When trip owner leaves, ownership transfers to oldest member
- [ ] When trip owner is the only member and leaves, trip is deleted
- [ ] Dashboard shows original creator name even after ownership transfer
- [ ] Dashboard shows "Host: you" indicator for current trip owner

### Critical User Flows
- [ ] User can create a trip and add 10 places via map clicks
- [ ] User can search for "coffee shops" and add results to map
- [ ] User can generate an AI itinerary that groups places into 3 days
- [ ] User can share trip with another person via email invitation
- [ ] Second user (collaborator) sees first user's changes in real-time (< 2 seconds)
- [ ] Second user sees first user's cursor on the map with name
- [ ] User can drag places between days to manually reorganize
- [ ] User can ask AI chat "Add 3 museums" and see pins auto-appear
- [ ] User can delete a place and see it removed from map
- [ ] Multiple users can collaborate on same trip simultaneously

### Browser Testing
- [ ] Chrome (desktop + mobile)
- [ ] Safari (desktop + mobile)
- [ ] Firefox (desktop)

### Performance Testing
- [ ] Map loads in < 3 seconds on 3G connection
- [ ] AI itinerary generation completes in < 10 seconds for 20 places
- [ ] No console errors in production build

---

## Post-Launch Improvements (Phase 10+)

### P1 (Next 2 Weeks)
- [x] Download itinerary as PDF with dates and locations
- [x] Collaborative notes feature (general trip notes + place-specific notes)
- [x] PDF download includes notes (general and place-specific)
- [ ] Add undo/redo for itinerary changes
- [ ] Export itinerary to Google Calendar
- [ ] Show travel time estimates between stops
- [ ] Add place photos (Mapbox Static Images API)

### P2 (Next Month)
- [ ] Email notifications for trip invitations
- [x] Trip comments/notes on places (completed as collaborative notes feature)
- [ ] Export itinerary to Google Calendar/iCal
- [ ] Mobile app (React Native)
- [ ] Trip templates (save and reuse itineraries)

### P3 (3+ Months)
- [ ] Multi-city trips (e.g., Tokyo + Kyoto)
- [ ] Budget tracking
- [ ] Booking integration (Booking.com affiliate)
- [ ] AI suggests optimal trip duration based on place density

---

## Risk Mitigation

### High-Risk Areas
1. **AI returns invalid JSON:** Mitigated by `generateObject` with Zod validation + fallback error UI
2. **Realtime sync race conditions:** Mitigated by optimistic updates + server reconciliation
3. **Free tier quotas exceeded:** Mitigated by rate limiting + usage monitoring

### Rollback Plan
- Keep `main` branch stable
- Deploy from `develop` branch
- Tag stable releases (v0.1.0, v0.2.0)
- If production breaks, revert to last stable tag

---

## Definition of Done (Per Phase)

Each phase is complete when:
[COMPLETED] Feature works in local dev environment  
[COMPLETED] Code is committed to Git with descriptive message  
[COMPLETED] Manual testing checklist passed (document in commit message)  
[COMPLETED] No console errors or warnings  
[COMPLETED] Code follows TypeScript strict mode (no `any` types)  

---

## Development Tools & Best Practices

### Recommended VS Code Extensions
- ES7+ React/Redux snippets
- Tailwind CSS IntelliSense
- Prettier
- ESLint

### Code Style
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use Tailwind utility classes (avoid custom CSS)
- Comment complex algorithms (e.g., clustering logic)

### Git Workflow
- Commit after each completed task (not per phase)
- Use conventional commits: `feat:`, `fix:`, `refactor:`
- Push to GitHub at end of each day

---

**Questions or blockers?** Reference the PRD for requirements clarification.  
**Ready to start?** Begin with Phase 0: Project Bootstrap.
