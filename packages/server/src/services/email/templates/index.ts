import { EmailTemplate } from "../types";
import type { BaseEmailTemplate } from "./base.template";
import { WaitlistConfirmationTemplate } from "./waitlist-confirmation.template";
import { WaitlistInvitationTemplate } from "./waitlist-invitation.template";
import { AdminWaitlistNotificationTemplate } from "./admin-waitlist-notification.template";

/**
 * Registry of all email templates, mapping EmailTemplate enum values to instances
 *
 * Provides lookup and registration methods for template-based email sending.
 */
export class EmailTemplateRegistry {
  private static templates = new Map<EmailTemplate, BaseEmailTemplate>([
    [EmailTemplate.WAITLIST_CONFIRMATION, new WaitlistConfirmationTemplate()],
    [EmailTemplate.WAITLIST_INVITATION, new WaitlistInvitationTemplate()],
    [
      EmailTemplate.ADMIN_WAITLIST_NOTIFICATION,
      new AdminWaitlistNotificationTemplate(),
    ],
  ]);

  /**
   * Retrieves a template instance by its enum key
   *
   * @param template - Template identifier
   * @returns The template instance, cast to the expected data type
   * @throws Error if the template is not registered
   */
  static get<TData = unknown>(
    template: EmailTemplate,
  ): BaseEmailTemplate<TData> {
    const templateInstance = this.templates.get(template);
    if (!templateInstance) {
      throw new Error(`Template ${template} not found`);
    }
    return templateInstance;
  }

  /** Registers a new template instance for a given enum key */
  static register(template: EmailTemplate, instance: BaseEmailTemplate): void {
    this.templates.set(template, instance);
  }
}

export * from "./base.template";
export * from "./waitlist-confirmation.template";
export * from "./waitlist-invitation.template";
export * from "./admin-waitlist-notification.template";
