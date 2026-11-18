import config from "@/config";

const MAX_RETURN_TO_LENGTH = 2048;

function buildAllowedOrigins(): Set<string> {
  const raw = [
    config.meta.links.website,
    ...config.app.auth.sso.corsOrigins,
    ...config.app.auth.sso.codeExchangeOrigins,
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
