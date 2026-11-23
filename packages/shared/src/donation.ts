export const DONATION_STATUSES = [
  "pending",
  "completed",
  "refunded",
  "cancelled",
] as const;

export type DonationStatus = (typeof DONATION_STATUSES)[number];
