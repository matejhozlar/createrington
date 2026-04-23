import fs from "node:fs";
import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import config from "@/config";
import type {
  EmailAddress,
  EmailAttachment,
  EmailOptions,
  EmailResult,
  EmailTemplate,
  EmailTemplateDataMap,
} from "./types";
import { EmailTemplateRegistry } from "./templates";

/**
 * Email Service
 *
 * Sends transactional emails via Resend:
 * - Plain emails with full header control (to, cc, bcc, replyTo, attachments)
 * - Template-based emails rendered from the EmailTemplateRegistry
 * - Convenience methods for delivering notifications directly to the admin
 * - Normalizes recipient addresses from string or structured email objects
 *
 * NOTE: Implemented as a singleton; use `EmailService.getInstance()` or
 * the pre-initialized `email` export rather than constructing directly
 */
export class EmailService {
  private static instance: EmailService;
  private resend: Resend;
  private fromEmail: string;
  private fromName: string;

  private constructor() {
    this.fromEmail = config.email.fromEmail;
    this.fromName = config.meta.author.name;

    this.resend = new Resend(config.email.apiKey);
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /** @private Formats an address input as "Name <email>" or plain email */
  private normalizeEmail(email: string | EmailAddress): string {
    if (typeof email === "string") return email;
    return email.name ? `${email.name} <${email.email}>` : email.email;
  }

  /** @private Normalizes a single or array input into an array of "Name <email>" strings */
  private normalizeEmails(
    emails: string | EmailAddress | Array<string | EmailAddress>,
  ): string[] {
    const emailArray = Array.isArray(emails) ? emails : [emails];
    return emailArray.map((e) => this.normalizeEmail(e));
  }

  // Our EmailAttachment uses `cid` for inline-image references (RFC 2392 /
  // nodemailer legacy); Resend uses `contentId` for the same purpose. Resend
  // resolves `<img src="cid:foo">` against any attachment whose `contentId`
  // matches `foo`, so the templates don't need to change.
  //
  // Resend's `path` field is remote-only (http/https). For attachments that
  // reference a local filesystem path, we read the file and pass `content`
  // instead — keeps the template API (filesystem paths) unchanged.
  private toResendAttachments(
    attachments?: EmailAttachment[],
  ): CreateEmailOptions["attachments"] {
    if (!attachments?.length) return undefined;
    return attachments.map((a) => {
      const isRemoteUrl =
        !!a.path &&
        (a.path.startsWith("http://") || a.path.startsWith("https://"));

      const content =
        a.content ??
        (a.path && !isRemoteUrl ? fs.readFileSync(a.path) : undefined);

      return {
        filename: a.filename,
        path: isRemoteUrl ? a.path : undefined,
        content,
        contentType: a.contentType,
        contentId: a.cid,
      };
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    const payload: CreateEmailOptions = {
      from: options.from
        ? this.normalizeEmail(options.from)
        : `${this.fromName} <${this.fromEmail}>`,
      to: this.normalizeEmails(options.to),
      cc: options.cc ? this.normalizeEmails(options.cc) : undefined,
      bcc: options.bcc ? this.normalizeEmails(options.bcc) : undefined,
      replyTo: options.replyTo
        ? this.normalizeEmail(options.replyTo)
        : undefined,
      subject: options.subject,
      html: options.html ?? "",
      text: options.text ?? "",
      attachments: this.toResendAttachments(options.attachments),
    };

    const { data, error } = await this.resend.emails.send(payload);

    if (error) {
      logger.error("Failed to send email:", error);
      return {
        success: false,
        error: error.message ?? "Unknown error",
      };
    }

    logger.info(
      `Email sent successfully: ${data?.id} to ${this.normalizeEmails(
        options.to,
      ).join(", ")}`,
    );

    return {
      success: true,
      messageId: data?.id,
    };
  }

  async sendTemplate<T extends EmailTemplate>(
    to: string | EmailAddress,
    template: T,
    data: EmailTemplateDataMap[T],
  ): Promise<EmailResult> {
    try {
      const templateInstance =
        EmailTemplateRegistry.get<EmailTemplateDataMap[T]>(template);
      const rendered = templateInstance.render(data);

      return this.send({
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        attachments: rendered.attachments,
      });
    } catch (error) {
      logger.error(`Failed to send template email (${template}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendToAdmin(
    subject: string,
    html: string,
    text?: string,
  ): Promise<EmailResult> {
    return this.send({
      to: config.meta.author.email,
      subject,
      html,
      text,
    });
  }

  async sendTemplateToAdmin<T extends EmailTemplate>(
    template: EmailTemplate,
    data: EmailTemplateDataMap[T],
  ): Promise<EmailResult> {
    return this.sendTemplate(config.meta.author.email, template, data);
  }

  /**
   * Lightweight health check — lists domains via the Resend API.
   *
   * Resend is HTTPS-only, so there's no SMTP-style connection to verify;
   * this just exercises the API key at a low cost to confirm credentials
   * are usable before the application begins accepting traffic.
   */
  async verify(): Promise<boolean> {
    try {
      const { error } = await this.resend.domains.list();
      if (error) {
        logger.error("Email verification failed:", error);
        return false;
      }
      logger.info("Email connection verified");
      return true;
    } catch (error) {
      logger.error("Email verification failed:", error);
      return false;
    }
  }
}

/** Pre-initialized singleton instance — use this instead of constructing EmailService directly */
export const email = EmailService.getInstance();
