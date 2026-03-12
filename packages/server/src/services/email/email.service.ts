import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import config from "@/config";
import type {
  EmailOptions,
  EmailResult,
  EmailTemplate,
  EmailTemplateDataMap,
} from "./types";
import { EmailTemplateRegistry } from "./templates";

/**
 * Email Service
 *
 * Sends transactional emails via Nodemailer:
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
  private transporter: Transporter;
  private fromEmail: string;
  private fromName: string;

  private constructor() {
    this.fromEmail = config.email.auth.user;
    this.fromName = config.meta.author.name;

    this.transporter = nodemailer.createTransport(config.email);
  }

  /** Returns the singleton instance, creating it on first call */
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }
  /**
   * Normalizes a single email address into a formatted string.
   *
   * Converts `{ email, name? }` objects into `"Name <email>"` format;
   * plain strings are returned as-is.
   *
   * @private
   * @param email - Email as string or object with email and optional name
   * @returns Formatted email string
   */
  private normalizeEmail(
    email: string | { email: string; name?: string },
  ): string {
    if (typeof email === "string") return email;
    return email.name ? `${email.name} <${email.email}>` : email.email;
  }

  /**
   * Normalizes one or more email addresses into an array of formatted strings.
   *
   * Accepts a single value or array of strings/objects and delegates each
   * element to `normalizeEmail`. Used internally for the to, cc, and bcc fields.
   *
   * @private
   * @param emails - Single email, email object, or array of either
   * @returns Array of formatted email strings
   */
  private normalizeEmails(
    emails:
      | string
      | { email: string; name?: string }
      | Array<string | { email: string; name?: string }>,
  ): string[] {
    const emailArray = Array.isArray(emails) ? emails : [emails];
    return emailArray.map((e) => this.normalizeEmail(e));
  }
  /**
   * Sends an email with the specified options.
   *
   * All recipient fields (to, cc, bcc, replyTo) are normalized before dispatch.
   * Falls back to the configured author name and email if `from` is not provided.
   *
   * @param options - Full email options including recipients, subject, and body
   * @returns Result with `success` flag and either `messageId` or `error` message
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from
          ? this.normalizeEmail(options.from)
          : `${this.fromName} <${this.fromEmail}>`,
        to: this.normalizeEmails(options.to).join(", "),
        cc: options.cc
          ? this.normalizeEmails(options.cc).join(", ")
          : undefined,
        bcc: options.bcc
          ? this.normalizeEmails(options.bcc).join(", ")
          : undefined,
        replyTo: options.replyTo
          ? this.normalizeEmail(options.replyTo)
          : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });

      logger.info(
        `Email sent successfully: ${info.messageId} to ${this.normalizeEmails(
          options.to,
        ).join(", ")}`,
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error("Failed to send email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Renders a template and sends the resulting email to a recipient.
   *
   * @param to - Recipient email address or `{ email, name }` object
   * @param template - Template identifier from the EmailTemplate enum
   * @param data - Type-safe data object required by the chosen template
   * @returns Result with `success` flag and either `messageId` or `error` message
   */
  async sendTemplate<T extends EmailTemplate>(
    to: string | { email: string; name?: string },
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

  /**
   * Sends a plain email to the configured admin address.
   *
   * @param subject - Email subject line
   * @param html - HTML body
   * @param text - Optional plain-text fallback
   * @returns Result with `success` flag and either `messageId` or `error` message
   */
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
  /**
   * Renders a template and sends the resulting email to the configured admin address.
   *
   * @param template - Template identifier from the EmailTemplate enum
   * @param data - Type-safe data object required by the chosen template
   * @returns Result with `success` flag and either `messageId` or `error` message
   */
  async sendTemplateToAdmin<T extends EmailTemplate>(
    template: EmailTemplate,
    data: EmailTemplateDataMap[T],
  ): Promise<EmailResult> {
    return this.sendTemplate(config.meta.author.email, template, data);
  }
  /**
   * Verifies the SMTP transporter connection.
   *
   * Useful for startup health checks to confirm the mail server is reachable
   * before the application begins accepting traffic.
   *
   * @returns `true` if the connection is successful, `false` otherwise
   */
  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
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
