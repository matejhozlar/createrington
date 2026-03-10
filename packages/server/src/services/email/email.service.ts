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
 * Singleton service for sending emails using Nodemailer
 *
 * Provides methods for sending plain emails, template-based emails, and admin notification emails
 * Automatically handles email formatting, normalization, and error handling
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

  /**
   * Gets the singleton instance of EmailService
   *
   * Creates a new instance if one doesn't exist, otherwise returns the existing instance
   *
   * @returns The EmailService singleton instance
   */
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }
  /**
   * Normalizes an email address into a string format
   *
   * Converts email objects with optional names into properly formatted email strings
   * Supports both plain email strings and objects with email/name properties
   *
   * @param email - Email as string or object with email and optional name
   * @returns Formatted email string
   * @private
   */
  private normalizeEmail(
    email: string | { email: string; name?: string },
  ): string {
    if (typeof email === "string") return email;
    return email.name ? `${email.name} <${email.email}>` : email.email;
  }

  /**
   * Normalizes one or more email addresses into an array of formatted strings
   *
   * Handles single emails, email objects, or arrays of either. Useful for processing
   * the "to", "cc", and "bcc" fields
   *
   * @param emails - Single email, email object, or array of either
   * @returns Array of formatted email strings
   * @private
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
   * Sends an email with the specified options
   *
   * Core email sending method that handles all email fields including recipients,
   * subject, content (HTML and plain text), and attachments. Automatically uses
   * default sender info if not specified
   *
   * @param options - Email configuration options
   * @param options.to - Recipient email(s)
   * @param options.subject - Email subject line
   * @param options.html - HTML version of the email body
   * @param options.text - Plain text version of the email body
   * @param options.from - Optional sender override (defaults to config author)
   * @param options.cc - Optional CC recipients
   * @param options.bcc - Optional BCC recipients
   * @param options.replyTo - Optional reply-to address
   * @param options.attachments - Optional file attachments
   * @returns Promise resolving to EmailResult with success status and messageId or error
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
   * Sends an email using a predefined template
   *
   * Renders the specified template with the provided data and sends the resulting email
   * Templates are retrieved from the EmailTemplateRepository
   *
   * @template T - The template type from EmailTemplate enum
   * @param to - Recipient email address
   * @param template - Template identifier from EmailTemplate enum
   * @param data - Data to populate the template with (type-safe based on template)
   * @returns Promise resolving to EmailResult with success status and messageId or error
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
   * Sends a plain email to the admin/author
   *
   * Convenience method for sending notifications or alerts to the configured
   * admin email address (from config.meta.author.email)
   *
   * @param subject - Email subject line
   * @param html - HTML version of the email body
   * @param text - Optional plain text version (if not provided, only HTML is sent)
   * @returns Promise resolving to EmailResult with success status and messageId or error
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
   * Sends a template-based email to the admin/author
   *
   * Convenience method for sending template emails to the configured admin
   * Useful for system notifications, error reports, or administrative alerts
   *
   * @template TData - The type of data required by the template
   * @param template - Template identifier from EmailTemplate enum
   * @param data - Data to populate the template with
   * @returns Promise resolving to EmailResult with success status and messageId or error
   */
  async sendTemplateToAdmin<T extends EmailTemplate>(
    template: EmailTemplate,
    data: EmailTemplateDataMap[T],
  ): Promise<EmailResult> {
    return this.sendTemplate(config.meta.author.email, template, data);
  }
  /**
   * Verifies the email transporter connection
   *
   * Tests the connection to the email server to ensure email can be sent
   * Useful for startup checks or health monitoring
   *
   * @returns Promise resolving to true if connection is successful, false otherwise
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

/**
 * Singleton instance of the email service
 *
 * Pre-initialized instance ready for use throughout the application
 */
export const email = EmailService.getInstance();
