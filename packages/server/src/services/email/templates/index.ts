import { EmailTemplate } from "../types";
import type { BaseEmailTemplate } from "./base.template";
import { WaitlistConfirmationTemplate } from "./waitlist-confirmation.template";
import { WaitlistInvitationTemplate } from "./waitlist-invitation.template";
import { AdminWaitlistNotificationTemplate } from "./admin-waitlist-notification.template";

export class EmailTemplateRegistry {
  private static templates = new Map<EmailTemplate, BaseEmailTemplate>([
    [EmailTemplate.WAITLIST_CONFIRMATION, new WaitlistConfirmationTemplate()],
    [EmailTemplate.WAITLIST_INVITATION, new WaitlistInvitationTemplate()],
    [
      EmailTemplate.ADMIN_WAITLIST_NOTIFICATION,
      new AdminWaitlistNotificationTemplate(),
    ],
  ]);

  static get<TData = unknown>(
    template: EmailTemplate,
  ): BaseEmailTemplate<TData> {
    const templateInstance = this.templates.get(template);
    if (!templateInstance) {
      throw new Error(`Template ${template} not found`);
    }
    return templateInstance;
  }

  static register(template: EmailTemplate, instance: BaseEmailTemplate): void {
    this.templates.set(template, instance);
  }
}

export * from "./base.template";
export * from "./waitlist-confirmation.template";
export * from "./waitlist-invitation.template";
export * from "./admin-waitlist-notification.template";
