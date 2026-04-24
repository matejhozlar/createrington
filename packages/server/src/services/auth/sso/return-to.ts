import config from "@/config";

/**
 * Return-to URL allowlist enforcement for the server-driven SSO flow.
 *
 * The /api/auth/sso/start endpoint accepts a `return_to` query param and,
 * after a successful Discord OAuth round-trip, redirects the user back to
 * that URL with the access + refresh cookies set. Without strict validation
 * this is an open redirect that lets an attacker phish credentials.
 *
 * The allowlist is built from `config.meta.links.website` +
 * `SSO_CORS_ORIGINS`, parsed as URL origins. Matching is exact-origin (host
 * + port + scheme) — no regex, so it can't be misconfigured via a forgotten
 * anchor or unescaped dot.
 */

const MAX_RETURN_TO_LENGTH = 2048;

function buildAllowedOrigins(): Set<string> {
  const raw = [
    config.meta.links.website,
    ...config.app.auth.sso.corsOrigins,
  ].filter(Boolean);

  const origins = new Set<string>();
  for (const entry of raw) {
    try {
      origins.add(new URL(entry).origin);
    } catch {
      throw new Error(`Invalid SSO origin in configuration: "${entry}"`);
    }
  }
  return origins;
}

const allowedOrigins = buildAllowedOrigins();

/**
 * Validate a candidate return_to URL against the allowlist.
 *
 * Rejects:
 * - Anything missing, longer than MAX_RETURN_TO_LENGTH, or not an absolute URL
 * - Non-https schemes (prevents downgrade attacks)
 * - Anything whose origin isn't in the federation allowlist
 *
 * Returns the original URL string on success so callers can `redirect()` it
 * directly. Returns null when the URL is missing, malformed, or not allowed.
 */
export function validateReturnTo(candidate: string | undefined): string | null {
  if (!candidate) return null;
  if (candidate.length > MAX_RETURN_TO_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (!allowedOrigins.has(parsed.origin)) return null;
  return candidate;
}

/**
 * Exposed for tests so they can build a validator over a synthetic allowlist
 * without going through env / config.
 */
export function makeReturnToValidator(origins: string[]) {
  const set = new Set(origins.map((o) => new URL(o).origin));
  return (candidate: string | undefined): string | null => {
    if (!candidate) return null;
    if (candidate.length > MAX_RETURN_TO_LENGTH) return null;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:") return null;
    if (!set.has(parsed.origin)) return null;
    return candidate;
  };
}
