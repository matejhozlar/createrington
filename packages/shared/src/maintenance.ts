export const MAINTENANCE_SCHEDULE_STATUSES = [
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;

export const MAINTENANCE_MAX_LEAD_DAYS = 90;
export const MAINTENANCE_MAX_LEAD_MS =
  MAINTENANCE_MAX_LEAD_DAYS * 24 * 60 * 60 * 1000;
