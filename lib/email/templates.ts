export function getInvitationEmailHTML(
  tripName: string,
  inviterName: string,
  inviteLink: string
): string {
  // Theme colors converted from oklch to approximate hex values
  // Primary: oklch(0.3732 0.0328 41.8087) ≈ #5a5a5a (dark gray/brown)
  // Background: oklch(0.9821 0 0) ≈ #fafafa (very light gray)
  // Card: oklch(0.9911 0 0) ≈ #fcfcfc (almost white)
  // Foreground: oklch(0.2435 0 0) ≈ #3d3d3d (dark gray)
  // Muted foreground: oklch(0.5032 0 0) ≈ #808080 (medium gray)
  // Border: oklch(0.8822 0 0) ≈ #e1e1e1 (light gray)
  
  const primaryColor = '#5a5a5a'; // Theme primary
  const backgroundColor = '#fafafa'; // Theme background
  const cardColor = '#fcfcfc'; // Theme card
  const foregroundColor = '#3d3d3d'; // Theme foreground
  const mutedColor = '#808080'; // Theme muted-foreground
  const borderColor = '#e1e1e1'; // Theme border
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to collaborate on ${tripName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Original+Surfer&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${backgroundColor};">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${cardColor}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid ${borderColor};">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: ${primaryColor}; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 400; font-family: 'Original Surfer', sans-serif; font-style: normal;">Trippee</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: ${foregroundColor}; font-size: 24px; font-weight: 600;">
                You've been invited!
              </h2>
              
              <p style="margin: 0 0 20px; color: ${foregroundColor}; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to collaborate on their trip: <strong>${tripName}</strong>
              </p>
              
              <p style="margin: 0 0 30px; color: ${foregroundColor}; font-size: 16px; line-height: 1.6;">
                Join them to plan the perfect itinerary together. Click the button below to accept the invitation:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 0 0 30px;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 0; color: ${mutedColor}; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: ${primaryColor}; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${backgroundColor}; border-radius: 0 0 8px 8px; border-top: 1px solid ${borderColor};">
              <p style="margin: 0; color: ${mutedColor}; font-size: 14px; text-align: center; line-height: 1.6;">
                This invitation will expire in 7 days.<br>
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer Text -->
        <table role="presentation" style="max-width: 600px; margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; padding: 20px;">
              <p style="margin: 0; color: ${mutedColor}; font-size: 12px;">
                © ${new Date().getFullYear()} Trippee. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getInvitationEmailText(
  tripName: string,
  inviterName: string,
  inviteLink: string
): string {
  return `
You've been invited to collaborate on a trip!

${inviterName} has invited you to collaborate on their trip: ${tripName}

Join them to plan the perfect itinerary together. Click the link below to accept the invitation:

${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} Trippee. All rights reserved.
  `.trim();
}

