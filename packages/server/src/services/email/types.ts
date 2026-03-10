/** Structured email address with optional display name */
export interface EmailAddress {
  email: string;
  name?: string;
}

/** File attachment for an outgoing email */
export interface EmailAttachment {
  filename: string;
  /** Filesystem path (mutually exclusive with content) */
  path?: string;
  /** Inline content (mutually exclusive with path) */
  content?: Buffer | string;
  contentType?: string;
  /** Content-ID for inline embedding in HTML (e.g., images) */
  cid?: string;
}

/** Options for sending a single email */
export interface EmailOptions {
  to: string | EmailAddress | Array<string | EmailAddress>;
  subject: string;
  html?: string;
  text?: string;
  cc?: string | EmailAddress | Array<string | EmailAddress>;
  bcc?: string | EmailAddress | Array<string | EmailAddress>;
  replyTo?: string | EmailAddress;
  attachments?: EmailAttachment[];
  from?: string | EmailAddress;
}

/** Result of an email send operation */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Available email template identifiers */
export enum EmailTemplate {
  WAITLIST_CONFIRMATION = "waitlist-confirmation",
  WAITLIST_INVITATION = "waitlist-invitation",
  ADMIN_WAITLIST_NOTIFICATION = "admin-waitlist-notification",
}

/** Template data for waitlist confirmation emails */
export interface WaitlistConfirmationData {
  discordName: string;
  position?: number;
}

/** Template data for waitlist invitation emails */
export interface WaitlistInvitationData {
  discordName: string;
  /** Verification token the user must present to claim their spot */
  token: string;
}

/** Template data for admin notification emails about new waitlist entries */
export interface AdminWaitlistNotificationData {
  id: number;
  email: string;
  discordName: string;
}

/** Maps each EmailTemplate enum value to its corresponding data type */
export type EmailTemplateDataMap = {
  [EmailTemplate.WAITLIST_CONFIRMATION]: WaitlistConfirmationData;
  [EmailTemplate.WAITLIST_INVITATION]: WaitlistInvitationData;
  [EmailTemplate.ADMIN_WAITLIST_NOTIFICATION]: AdminWaitlistNotificationData;
};
