export function getInvitationEmailHTML(
  tripName: string,
  inviterName: string,
  inviteLink: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited to collaborate on ${tripName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Trippee</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #1a1a1a; font-size: 24px; font-weight: 600;">
                You've been invited!
              </h2>
              
              <p style="margin: 0 0 20px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to collaborate on their trip: <strong>${tripName}</strong>
              </p>
              
              <p style="margin: 0 0 30px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Join them to plan the perfect itinerary together. Click the button below to accept the invitation:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: center; padding: 0 0 30px;">
                    <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 0; color: #8a8a8a; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #8a8a8a; font-size: 14px; text-align: center; line-height: 1.6;">
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
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
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

