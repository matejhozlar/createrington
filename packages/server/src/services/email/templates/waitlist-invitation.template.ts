import path from "node:path";
import { fileURLToPath } from "node:url";
import { BaseEmailTemplate } from "./base.template";
import type { EmailAttachment, WaitlistInvitationData } from "../types";
import config from "@/config";

const links = config.meta.links;

/** Email template for inviting a waitlisted user to join the server */
export class WaitlistInvitationTemplate extends BaseEmailTemplate<WaitlistInvitationData> {
  protected getSubject(_data: WaitlistInvitationData): string {
    return "Your Invitation to Createrington is Ready!";
  }

  protected getHtml(data: WaitlistInvitationData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Invitation to Createrington</title>
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

              <!-- Hero Banner -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background: linear-gradient(135deg, #d4a843 0%, #b8922f 100%); padding: 36px 40px; text-align: center;">
                    <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 700; color: #0f0d19; letter-spacing: -0.5px;">
                      You're Invited!
                    </h1>
                    <p style="margin: 0; font-size: 15px; color: #3d2e10; font-weight: 500;">
                      A spot has opened up and it's yours
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Feature Image -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 0;">
                    <img src="${links.assets}/gondola-station.webp" alt="Createrington Server" width="600" style="display: block; width: 100%; height: auto; border: 0;" />
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 32px 40px 0;">
                    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #ededf0;">
                      Hi <strong>${data.discordName}</strong>,
                    </p>
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #a09bab;">
                      Great news &mdash; a spot has just opened up on <strong style="color: #ededf0;">Createrington</strong>, and you're next in line! We're excited to welcome you to the server and can't wait to see what you'll create.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- What is Createrington -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 28px 40px 0;">
                    <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #d4a843;">
                      What is Createrington?
                    </h2>
                    <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #a09bab;">
                      Createrington is a carefully curated Minecraft Create mod server focused on mechanical innovation, aesthetic building, and quality-of-life improvements. With a Vanilla+ feel and a vibrant, collaborative community, it's the perfect place to bring your most imaginative ideas to life.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Highlights -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 28px 40px 0;">
                    <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #d4a843;">
                      Highlights of the Experience
                    </h2>
                  </td>
                </tr>
              </table>

              <!-- Feature Grid (2 columns) -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" valign="top" style="padding: 0 8px 16px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #231f33; border-radius: 12px; padding: 16px;">
                                <p style="margin: 0 0 6px; font-size: 20px; line-height: 1;">&#9881;</p>
                                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #ededf0;">Automation</p>
                                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b6575;">Create & its add-ons for advanced machines</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" valign="top" style="padding: 0 0 16px 8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #231f33; border-radius: 12px; padding: 16px;">
                                <p style="margin: 0 0 6px; font-size: 20px; line-height: 1;">&#127912;</p>
                                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #ededf0;">Building</p>
                                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b6575;">Macaw's, Chipped, and Rechiseled</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" valign="top" style="padding: 0 8px 16px 0;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #231f33; border-radius: 12px; padding: 16px;">
                                <p style="margin: 0 0 6px; font-size: 20px; line-height: 1;">&#127860;</p>
                                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #ededf0;">Food & Farming</p>
                                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b6575;">Farmer's Delight and more</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td width="50%" valign="top" style="padding: 0 0 16px 8px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td style="background-color: #231f33; border-radius: 12px; padding: 16px;">
                                <p style="margin: 0 0 6px; font-size: 20px; line-height: 1;">&#128101;</p>
                                <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #ededf0;">Multiplayer</p>
                                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #6b6575;">FTB Teams & Simple Voice Chat</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 28px 40px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-top: 1px solid #2a2540;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 28px 40px 0;">
                    <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #d4a843;">
                      Next Steps
                    </h2>
                    <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #a09bab;">
                      To join, use the verification token below and follow the instructions in our Discord. If we don't hear back within <strong style="color: #ededf0;">48 hours</strong>, the spot may be offered to the next person in the queue.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Token Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 0 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color: #231f33; border: 1px solid #2a2540; border-left: 4px solid #d4a843; border-radius: 0 12px 12px 0; padding: 20px 24px;">
                          <p style="margin: 0 0 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #6b6575; font-weight: 600;">
                            Verification Token
                          </p>
                          <p style="margin: 0; font-size: 24px; font-weight: 700; font-family: 'Courier New', Courier, monospace; color: #d4a843; letter-spacing: 2px;">
                            ${data.token}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding: 28px 40px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="border-radius: 10px; background: linear-gradient(135deg, #d4a843 0%, #b8922f 100%);">
                          <a href="${links.discordInvite}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 700; color: #0f0d19; text-decoration: none; letter-spacing: 0.3px;">
                            Join our Discord
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Closing -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding: 0 40px; border-top: 1px solid #2a2540;">
                    <p style="margin: 24px 0 20px; font-size: 15px; line-height: 1.7; color: #a09bab;">
                      Looking forward to seeing you in-game and watching your creations come to life!
                    </p>
                    <p style="margin: 0 0 4px; font-size: 15px; color: #ededf0; font-weight: 600;">
                      Best regards,
                    </p>
                    <p style="margin: 0 0 4px; font-size: 15px; color: #d4a843; font-weight: 600;">
                      saunhardy
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #6b6575;">
                      Server Admin &mdash; Createrington
                    </p>
                    <p style="margin: 4px 0 0; font-size: 14px;">
                      <a href="${links.website}" style="color: #d4a843; text-decoration: none;">${links.website}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Bottom Padding -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="height: 32px;"></td></tr>
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
                This is an automated message &mdash; if you need help, contact <strong style="color: #a09bab;">matejhoz</strong> on Discord
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

  protected getText(data: WaitlistInvitationData): string {
    return `
Hi ${data.discordName},

Great news — a spot has just opened up on Createrington, and you're next in line! We're excited to welcome you to the server and can't wait to see what you'll create.

What is Createrington?

Createrington is a carefully curated Minecraft Create mod server focused on mechanical innovation, aesthetic building, and quality-of-life improvements. With a Vanilla+ feel and a vibrant, collaborative community, it's the perfect place to bring your most imaginative ideas to life.

Highlights of the Experience:

- Advanced automation with Create & its add-ons
- Gorgeous builds using Macaw's, Chipped, and Rechiseled
- Expanded food options with Farmer's Delight and more
- Optimized performance and smooth visuals
- Seamless multiplayer with FTB Teams and Simple Voice Chat

Next Steps:

To join, use the verification token below and follow the instructions in our Discord. If we don't hear back within 48 hours, the spot may be offered to the next person in the queue.

Your verification token: ${data.token}

Join our Discord: ${links.discordInvite}

Looking forward to seeing you in-game and watching your creations come to life!

Best regards,
saunhardy
Server Admin – Createrington
${links.website}

---
This is an automated message — if you need help, contact matejhoz on Discord
    `.trim();
  }

  protected getAttachments(_data: WaitlistInvitationData): EmailAttachment[] {
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
