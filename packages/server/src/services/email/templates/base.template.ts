import type { EmailAttachment } from "../types";

/**
 * Abstract base class for email templates
 *
 * Provides a standardized structure for creating email templates with support
 * for HTML, plain text, subject lines, and attachments. All email templates
 * should extend this class and implement the required abstract methods
 *
 * @template TData - The type of data required to render the email template
 */
export abstract class BaseEmailTemplate<TData = unknown> {
  /**
   * Generates the email subject line
   *
   * @param data - Template data used to generate the subject
   * @returns The email subject line
   */
  protected abstract getSubject(data: TData): string;
  /**
   * Generates the HTML version of the email body
   *
   * Should return a complete HTML with proper styling
   * This is what most email clients will display
   *
   * @param data - Template data used to generate the HTML format
   * @returns HTML string for the email body
   */
  protected abstract getHtml(data: TData): string;
  /**
   * Generates the plain text version of the email body
   *
   * Fallback content for email clients that don't support HTML or when
   * users prefer plain text. Should convey the same information as the HTML version
   *
   * @param data - Template data used to generate the plain text content
   * @returns Plain text string for the email body
   */
  protected abstract getText(data: TData): string;
  /**
   * Generates email attachments (optional)
   *
   * Override this method if the template needs to include attachments
   * such as PDFs, images, or other files. Returns an empty array by default
   *
   * @param data - Template data used to generate attachments
   * @returns Array of email attachments
   */
  protected getAttachments(_data: TData): EmailAttachment[] {
    return [];
  }
  /**
   * Renders the complete email using the provided data
   *
   * Calls all template methods and returns a complete email object ready
   * to be sent via an email service
   *
   * @param data - Template data to render the email with
   * @returns Object containing all rendered email components
   */
  public render(data: TData): {
    subject: string;
    html: string;
    text: string;
    attachments: EmailAttachment[];
  } {
    return {
      subject: this.getSubject(data),
      html: this.getHtml(data),
      text: this.getText(data),
      attachments: this.getAttachments(data),
    };
  }
}
