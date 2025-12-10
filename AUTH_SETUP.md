# Authentication Setup Instructions

## What's Been Implemented

All authentication code has been added to the codebase:

1. **Database Migration SQL** - `supabase/migrations/001_auth_schema.sql`
2. **Server-side Supabase client** - `lib/supabase/server.ts`
3. **Middleware** - `middleware.ts` (session management)
4. **Auth Components** - `components/auth/AuthModal.tsx`, `AuthProvider.tsx`
5. **Auth Hook** - `lib/hooks/useAuth.ts`
6. **Auth Callback Route** - `app/auth/callback/route.ts`
7. **Header Component** - `components/layout/Header.tsx`
8. **Updated TripPage** - Now uses real user IDs instead of localStorage
9. **Updated Landing Page** - Requires auth to create trips

## What You Need to Do

### Step 1: Run Database Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_auth_schema.sql`
4. Paste and run it in the SQL Editor

This will create:
- `profiles` table
- `trip_members` table  
- `trip_invitations` table
- Update `trips` table with `created_by` column
- Update `places` table `created_by` to be UUID
- Add Row Level Security (RLS) policies
- Create triggers for auto-creating profiles

### Step 2: Enable Authentication Providers

1. Go to **Authentication → Providers** in Supabase Dashboard
2. Enable **Email** provider (should already be enabled)
3. Enable **Google** OAuth provider:
   - You'll need Google OAuth credentials from Google Cloud Console
   - Add Client ID and Client Secret
   - Set redirect URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - For local dev: `http://localhost:3000/auth/callback`

### Step 3: Test Authentication

1. Start your dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Click "Sign In" in the header
4. Try signing up with email/password
5. Try signing in with Google (if configured)

### Step 4: Update Existing Trips (Optional)

If you have existing trips without `created_by`, you may want to:

```sql
-- Set created_by for existing trips (replace 'user-id-here' with actual user ID)
UPDATE trips 
SET created_by = 'user-id-here' 
WHERE created_by IS NULL;
```

## What Changed

### Before (Phase 7):
- Used `localStorage` for user IDs
- No authentication required
- Anonymous collaboration

### After (With Auth):
- Real user accounts (email/password + Google OAuth)
- User profiles automatically created
- Trip ownership and permissions
- Proper user identification in real-time collaboration
- Protected routes (must be signed in to view trips)

## Next Steps

After authentication is working, you can implement:
- **Phase 8.5**: Trip Sharing & Invitations
- **Phase 9**: User Dashboard & Trip Management

These phases are already documented in `IMPLEMENTATION_PLAN.md`.

## Important Notes

1. **RLS Policies**: All tables now have Row Level Security enabled. Users can only see trips they own or are members of.

2. **Existing Data**: If you have existing places/trips, you may need to:
   - Assign them to a user (set `created_by`)
   - Or temporarily disable RLS for migration

3. **Google OAuth**: Optional but recommended. You can test with just email/password first.

4. **Profile Creation**: Profiles are automatically created when a user signs up via the trigger function.

## Troubleshooting

**"Users can view trips they're members of" policy error:**
- Make sure you've run the migration SQL
- Check that RLS is enabled on the `trips` table

**"Unauthorized" errors:**
- Check that middleware is working (should be automatic)
- Verify user is signed in
- Check browser console for auth errors

**Google OAuth not working:**
- Verify redirect URL matches exactly
- Check Google Cloud Console OAuth settings
- Make sure Client ID/Secret are correct in Supabase

