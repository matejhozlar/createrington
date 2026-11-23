import config from "@/config";

const MAX_RETURN_TO_LENGTH = 2048;

function toOrigin(entry: string): string {
  try {
    return new URL(entry).origin;
  } catch {
    throw new Error(`Invalid SSO origin in configuration: "${entry}"`);
  }
}

export function makeReturnToValidator(origins: string[]) {
  const allowedOrigins = new Set(origins.map(toOrigin));
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
    if (!allowedOrigins.has(parsed.origin)) return null;
    return candidate;
  };
}

export const validateReturnTo = makeReturnToValidator(
  [
    config.meta.links.website,
    ...config.app.auth.sso.corsOrigins,
    ...config.app.auth.sso.codeExchangeOrigins,
  ].filter(Boolean),
);
