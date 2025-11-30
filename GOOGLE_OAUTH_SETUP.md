# Google OAuth Setup Guide

This guide will walk you through setting up Google OAuth for Supabase authentication.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click the project dropdown at the top
4. Click **"New Project"**
5. Enter a project name (e.g., "Trippee")
6. Click **"Create"**
7. Wait for the project to be created, then select it from the dropdown

## Step 2: Enable Google+ API

1. In the Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"** or **"People API"**
3. Click on it and click **"Enable"**
   - Note: Google+ API is deprecated, but you can use **"Google Identity Services"** instead
   - For OAuth, you actually need **"Google Identity"** which is enabled by default

## Step 3: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted, configure the OAuth consent screen first (see Step 4 below)
5. For **Application type**, select **"Web application"**
6. Give it a name (e.g., "Trippee Web App")

## Step 4: Configure OAuth Consent Screen (if prompted)

If you haven't set this up before, you'll be asked to configure it:

1. Choose **"External"** (unless you have a Google Workspace account)
2. Click **"Create"**
3. Fill in the required fields:
   - **App name**: "Trippee" (or your app name)
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **"Save and Continue"**
5. On **Scopes** page, click **"Save and Continue"** (default scopes are fine)
6. On **Test users** page, you can add test users or skip for now
7. Click **"Save and Continue"**
8. Review and go back to creating credentials

## Step 5: Set Up Authorized Redirect URIs

When creating the OAuth client ID:

1. Under **"Authorized redirect URIs"**, click **"+ ADD URI"**
2. Add these URIs:

   **For Supabase Production:**
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your actual Supabase project reference.
   - Find it in Supabase Dashboard → Settings → API → Project URL
   - It looks like: `abcdefghijklmnop.supabase.co`

   **For Local Development:**
   ```
   http://localhost:3000/auth/callback
   ```

3. Click **"Create"**

## Step 6: Copy Your Credentials

After creating the OAuth client:

1. You'll see a popup with:
   - **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
   - **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

2. **Copy both** - you'll need them for Supabase

## Step 7: Add Credentials to Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Providers**
4. Find **"Google"** in the list
5. Toggle it **"Enabled"**
6. Paste your:
   - **Client ID (for OAuth)**
   - **Client Secret (for OAuth)**
7. Click **"Save"**

## Step 8: Test It

1. Start your dev server: `npm run dev`
2. Visit `http://localhost:3000`
3. Click **"Sign In"** in the header
4. Click **"Continue with Google"**
5. You should be redirected to Google sign-in
6. After signing in, you'll be redirected back to your app

## Troubleshooting

### "redirect_uri_mismatch" Error

- Make sure the redirect URI in Google Cloud Console **exactly matches** what Supabase expects
- For Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
- Check for trailing slashes, http vs https, etc.

### "Access blocked: This app's request is invalid"

- Your app might be in testing mode
- Go to **OAuth consent screen** → **Publishing status**
- Add test users, or publish the app (requires verification for production)

### "Error 400: invalid_request"

- Check that both Client ID and Client Secret are correct
- Make sure there are no extra spaces when copying
- Verify the credentials are for a "Web application" type

### OAuth Not Showing in Supabase

- Make sure you've enabled the Google provider in Supabase
- Check that credentials are saved correctly
- Try refreshing the Supabase dashboard

## Quick Reference

**Google Cloud Console:** https://console.cloud.google.com/

**Supabase Dashboard:** https://supabase.com/dashboard

**Redirect URI Format:**
- Production: `https://<project-ref>.supabase.co/auth/v1/callback`
- Local: `http://localhost:3000/auth/callback`

## Security Notes

- **Never commit** your Client Secret to version control
- Keep your Client Secret secure
- If compromised, regenerate it in Google Cloud Console
- For production, consider restricting OAuth to specific domains

