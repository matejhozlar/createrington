export const ACTIVE_BAN_WHERE =
  "unbanned = false AND (expires_at IS NULL OR expires_at > NOW())";

export const EXPIRED_BAN_WHERE =
  "ban_type = 'temporary' AND unbanned = false AND expires_at IS NOT NULL AND expires_at <= NOW()";
