import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EmailAttachment, WaitlistConfirmationData } from "../types";
import { BaseEmailTemplate } from "./base.template";

/** Email template for confirming a user has been added to the waitlist */
export class WaitlistConfirmationTemplate extends BaseEmailTemplate<WaitlistConfirmationData> {
  protected getSubject(_data: WaitlistConfirmationData): string {
    return "You're on the waitlist!";
  }

  protected getHtml(data: WaitlistConfirmationData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're on the waitlist!</title>
  <!--[if mso]>
  <style>table, td { border-collapse: collapse; }</style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #0f0d19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0f0d19;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <img src="cid:createrington-logo" alt="Createrington" width="160" style="display: block; border: 0;" />
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td style="background-color: #1a1726; border-radius: 16px; border: 1px solid #2a2540; overflow: hidden;">

              <!-- Gold Header Banner -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #d4a843 0%, #b8922f 100%); padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #0f0d19; letter-spacing: -0.5px;">
                      Welcome to the Waitlist!
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 32px 40px;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #ededf0;">
                      Hey <strong>${data.discordName}</strong>,
                    </p>

                    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #a09bab;">
                      Thanks for your interest in joining <strong style="color: #ededf0;">Createrington</strong>! You've been successfully added to our waitlist. We'll let you know as soon as a spot opens up.
                    </p>

                    ${
                      data.position
                        ? `
                    <!-- Position Box -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                      <tr>
                        <td style="background-color: #231f33; border-left: 4px solid #d4a843; border-radius: 0 12px 12px 0; padding: 20px 24px;">
                          <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b6575; font-weight: 600;">
                            Your Position
                          </p>
                          <p style="margin: 0; font-size: 32px; font-weight: 700; color: #d4a843;">
                            #${data.position}
                          </p>
                        </td>
                      </tr>
                    </table>
                    `
                        : ""
                    }

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #2a2540;">
                          <h2 style="margin: 16px 0 12px; font-size: 18px; font-weight: 600; color: #ededf0;">
                            What happens next?
                          </h2>
                          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #a09bab;">
                            When a spot becomes available, we'll send you an invitation email with a verification token and instructions on how to join. In the meantime, feel free to hang out in our Discord community!
                          </p>

                          <!-- Discord Button -->
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" style="border-radius: 10px; background-color: #5865F2;">
                                <a href="https://discord.gg/mtF6MDHj4Z" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                                  Join our Discord
                                </a>
                              </td>
                            </tr>
                          </table>
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
            <td align="center" style="padding: 32px 16px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #6b6575;">
                <strong style="color: #a09bab;">Createrington</strong> &mdash; Minecraft Create Server
              </p>
              <p style="margin: 0; font-size: 13px; color: #6b6575;">
                Questions? Contact us on Discord: <strong style="color: #a09bab;">matejhoz</strong>
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

  protected getText(data: WaitlistConfirmationData): string {
    return `
Hey ${data.discordName},

Thanks for your interest in joining Createrington! You've been successfully added to our waitlist.

${data.position ? `Your current position: #${data.position}` : ""}

We'll notify you via email as soon as a spot opens up.

What happens next?
When a spot becomes available, we'll send you an invitation email with a verification token and instructions on how to join.

Join our Discord: https://discord.gg/mtF6MDHj4Z

---
Createrington - Minecraft Create Server
Questions? Contact us on Discord: matejhoz
    `.trim();
  }

  protected getAttachments(_data: WaitlistConfirmationData): EmailAttachment[] {
    const logoPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "..",
      "assets",
      "logo.png",
    );

    return [
      {
        filename: "logo.png",
        path: logoPath,
        cid: "createrington-logo",
      },
    ];
  }
}
