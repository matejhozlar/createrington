import type { AdminWaitlistNotificationData } from "../types";
import { BaseEmailTemplate } from "./base.template";

/** Email template for notifying the admin about a new waitlist submission */
export class AdminWaitlistNotificationTemplate extends BaseEmailTemplate<AdminWaitlistNotificationData> {
  protected getSubject(data: AdminWaitlistNotificationData): string {
    return `New Waitlist Submission: ${data.discordName ?? data.email}`;
  }

  protected getHtml(data: AdminWaitlistNotificationData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Waitlist Submission</title>
  <!--[if mso]>
  <style>table, td { border-collapse: collapse; }</style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f0d19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f0d19;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%;">

          <!-- Header Badge -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color: #231f33; border-radius: 20px; padding: 8px 20px;">
                    <p style="margin: 0; font-size: 13px; font-weight: 600; color: #d4a843; text-transform: uppercase; letter-spacing: 1px;">
                      Admin Notification
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color: #1a1726; border-radius: 16px; border: 1px solid #2a2540; overflow: hidden;">

              <!-- Title -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 28px 32px 20px; border-bottom: 1px solid #2a2540;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ededf0;">
                      New Waitlist Submission
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Data Rows -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <!-- ID Row -->
                <tr>
                  <td style="padding: 16px 32px; border-bottom: 1px solid #2a2540;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="100" style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #6b6575; font-weight: 600; vertical-align: top; padding-top: 2px;">
                          ID
                        </td>
                        <td style="font-size: 15px; color: #ededf0; font-weight: 500;">
                          ${data.id}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Discord Row -->
                <tr>
                  <td style="padding: 16px 32px; border-bottom: 1px solid #2a2540;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="100" style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #6b6575; font-weight: 600; vertical-align: top; padding-top: 2px;">
                          Discord
                        </td>
                        <td style="font-size: 15px; color: #d4a843; font-weight: 600;">
                          ${data.discordName ?? "N/A"}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Email Row -->
                <tr>
                  <td style="padding: 16px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="100" style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #6b6575; font-weight: 600; vertical-align: top; padding-top: 2px;">
                          Email
                        </td>
                        <td style="font-size: 15px; color: #ededf0;">
                          <a href="mailto:${data.email}" style="color: #a09bab; text-decoration: none;">${data.email}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 24px 16px;">
              <p style="margin: 0; font-size: 13px; color: #6b6575;">
                Createrington &mdash; Waitlist System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  protected getText(data: AdminWaitlistNotificationData): string {
    return `
New Waitlist Submission
---
ID: ${data.id}
Discord: ${data.discordName ?? "N/A"}
Email: ${data.email}
---
Createrington - Waitlist System
    `.trim();
  }
}
