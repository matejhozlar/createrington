export const WAITLIST_STATUSES = [
  "queued",
  "promoted",
  "registered",
  "expired",
] as const;

export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
