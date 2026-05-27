import { readFile } from "node:fs/promises";
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
 * Sends transactional email via Resend, supporting both raw HTML/text payloads and
 * `EmailTemplateRegistry`-rendered templates. When `RESEND_API_KEY` is unconfigured
 * the service stays alive but every send is a logged no-op returning a failure
 * result, so callers do not need to gate on env config. Singleton; prefer the
 * pre-initialized `email` export over constructing it directly.
 */
export class EmailService {
  private static instance: EmailService;
  private resend: Resend | null;
  private fromEmail: string;
  private fromName: string;

  private constructor() {
    this.fromEmail = config.email.fromEmail;
    this.fromName = config.meta.author.name;

    this.resend = config.email.enabled ? new Resend(config.email.apiKey) : null;
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private normalizeEmail(email: string | EmailAddress): string {
    if (typeof email === "string") return email;
    return email.name ? `${email.name} <${email.email}>` : email.email;
  }

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
  // instead. Keeps the template API (filesystem paths) unchanged.
  private async toResendAttachments(
    attachments?: EmailAttachment[],
  ): Promise<CreateEmailOptions["attachments"]> {
    if (!attachments?.length) return undefined;
    return Promise.all(
      attachments.map(async (a) => {
        const isRemoteUrl =
          !!a.path &&
          (a.path.startsWith("http://") || a.path.startsWith("https://"));

        const content =
          a.content ??
          (a.path && !isRemoteUrl ? await readFile(a.path) : undefined);

        return {
          filename: a.filename,
          path: isRemoteUrl ? a.path : undefined,
          content,
          contentType: a.contentType,
          contentId: a.cid,
        };
      }),
    );
  }

  /** Sends a raw email; returns a failure result (not a throw) when Resend is unconfigured or the API rejects the send. */
  async send(options: EmailOptions): Promise<EmailResult> {
    if (!this.resend) {
      logger.warn(
        "Email send skipped: RESEND_API_KEY not configured (set it to enable transactional email)",
      );
      return { success: false, error: "Email service not configured" };
    }
    try {
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
        attachments: await this.toResendAttachments(options.attachments),
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
    } catch (error) {
      // Catches transport-level failures (network, DNS, SDK throws) that
      // the Resend `{ data, error }` pattern does not surface as values.
      logger.error("Failed to send email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /** Renders the named template from `EmailTemplateRegistry` with `data` and sends it. */
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

  /** Convenience: sends a plain email to the configured admin address. */
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

  /** Convenience: renders a template and sends it to the configured admin address. */
  async sendTemplateToAdmin<T extends EmailTemplate>(
    template: EmailTemplate,
    data: EmailTemplateDataMap[T],
  ): Promise<EmailResult> {
    return this.sendTemplate(config.meta.author.email, template, data);
  }

  /**
   * Lightweight health check: lists domains via the Resend API to confirm the
   * API key is usable. Returns false (no throw) when unconfigured or rejected.
   */
  async verify(): Promise<boolean> {
    if (!this.resend) {
      logger.warn("Email verification skipped: RESEND_API_KEY not configured");
      return false;
    }
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

/** Pre-initialized singleton instance: use this instead of constructing EmailService directly */
export const email = EmailService.getInstance();
