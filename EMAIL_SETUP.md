# Email Setup Instructions for Trip Invitations

## Overview

Trip invitations are now sent via email using Resend. When a trip owner invites someone, they receive a beautifully formatted email with an invitation link.

## Setup Steps

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. Go to your Resend Dashboard
2. Navigate to **API Keys**
3. Click **Create API Key**
4. Give it a name (e.g., "Trippee Production")
5. Copy the API key (you'll only see it once!)

### 3. Add Environment Variables

Add these to your `.env.local` file:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=Trippee <noreply@yourdomain.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Production:**
- `RESEND_FROM_EMAIL`: Use your verified domain (e.g., `Trippee <noreply@trippee.com>`)
- `NEXT_PUBLIC_APP_URL`: Your production URL (e.g., `https://trippee.com`)

### 4. Verify Your Domain (Production Only)

For production, you'll need to verify your domain:

1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Add your domain (e.g., `trippee.com`)
4. Add the DNS records Resend provides to your domain's DNS settings
5. Wait for verification (usually takes a few minutes)

**For Development:**
- You can use the default `onboarding@resend.dev` email address
- This is automatically available and works for testing

### 5. Test the Email

1. Start your dev server: `npm run dev`
2. Create a trip
3. Click "Share Trip"
4. Enter an email address
5. Click "Send Invite"
6. Check the recipient's inbox for the invitation email

## Email Template

The invitation email includes:
- Trip name
- Inviter's name
- Beautiful HTML design with gradient header
- Clear call-to-action button
- Alternative text link
- Expiration notice (7 days)

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Make sure `RESEND_API_KEY` is set correctly in `.env.local`
2. **Check Logs**: Look for error messages in your terminal/console
3. **Check Resend Dashboard**: Go to Resend Dashboard → Logs to see email status
4. **Development Mode**: If `RESEND_API_KEY` is not set, the invitation will still be created but no email will be sent (you'll see a warning in logs)

### Email Going to Spam

1. **Verify Domain**: Make sure your domain is verified in Resend
2. **Use Custom Domain**: Use your verified domain in `RESEND_FROM_EMAIL`
3. **Check SPF/DKIM Records**: Resend provides these when you verify your domain

### Testing Without Email

If you want to test without sending emails:
- Don't set `RESEND_API_KEY` in `.env.local`
- The invitation will still be created
- You can copy the invite link from the response
- The link will still work for accepting invitations

## Free Tier Limits

Resend's free tier includes:
- 3,000 emails/month
- 100 emails/day
- Perfect for development and small-scale production

For production, consider upgrading if you expect more traffic.

