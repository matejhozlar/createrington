import config from "@/config";

/**
 * Return-to URL whitelist enforcement for the server-driven SSO flow.
 *
 * The /api/auth/sso/start endpoint accepts a `return_to` query param and,
 * after a successful Discord OAuth round-trip, redirects the user back to
 * that URL with the access + refresh cookies set. Without strict validation
 * this is an open redirect that lets an attacker phish credentials.
 *
 * Patterns come from the SSO_RETURN_TO_WHITELIST env var (comma-separated
 * regex strings). Each pattern is anchored to the beginning of the string;
 * authors should include a trailing `(/.*)?$` if they want path freedom.
 *
 * Compiled once at module load. A change to the whitelist requires a server
 * restart, which is the same as every other env-derived value.
 */

const compiledPatterns: RegExp[] = config.app.auth.sso.returnToWhitelist.map(
  (pattern) => {
    try {
      return new RegExp(pattern);
    } catch (cause) {
      throw new Error(
        `Invalid SSO_RETURN_TO_WHITELIST pattern "${pattern}": ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
  },
);

/**
 * Validate a candidate return_to URL against the configured whitelist.
 *
 * Rejects:
 * - Anything that doesn't parse as an absolute URL
 * - Non-https schemes (prevents downgrade attacks)
 * - Anything no whitelist pattern matches
 *
 * Returns the original URL string on success so callers can `redirect()` it
 * directly. Returns null when the URL is missing, malformed, or not allowed.
 */
export function validateReturnTo(candidate: string | undefined): string | null {
  if (!candidate) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  for (const pattern of compiledPatterns) {
    if (pattern.test(candidate)) return candidate;
  }
  return null;
}

/**
 * Exposed for tests so they can build a validator over a synthetic whitelist
 * without going through env / config.
 */
export function makeReturnToValidator(patterns: string[]) {
  const compiled = patterns.map((p) => new RegExp(p));
  return (candidate: string | undefined): string | null => {
    if (!candidate) return null;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:") return null;
    for (const pattern of compiled) {
      if (pattern.test(candidate)) return candidate;
    }
    return null;
  };
}
