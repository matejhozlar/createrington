import config from "@/config";

/**
 * Classification and presentation of SSO consumers.
 *
 * The server-driven SSO flow finishes two different ways depending on the
 * consumer (see auth.controller.ts): code-exchange consumers (skin-api) get a
 * one-time `?code=`, while cookie consumers (sandbox, panel, main) ride the
 * shared `.createrington.com` cookies. The consent screen also needs a human
 * label for whichever app initiated the flow.
 */

/**
 * True when the return_to origin is configured for code-exchange SSO
 * (skin-api), so the flow issues a one-time code instead of cookies.
 */
export function isCodeExchangeReturnTo(returnTo: string): boolean {
  let origin: string;
  try {
    origin = new URL(returnTo).origin;
  } catch {
    return false;
  }
  return config.app.auth.sso.codeExchangeOrigins.some((allowed) => {
    try {
      return new URL(allowed).origin === origin;
    } catch {
      return false;
    }
  });
}

const KNOWN_SUBDOMAIN_NAMES: Record<string, string> = {
  api: "Skin API",
  sandbox: "Sandbox",
  panel: "Panel",
};

/**
 * Friendly name for the requesting app, derived from the return_to host. The
 * main website resolves to "Createrington"; known subdomains map to their
 * product names; anything else falls back to a title-cased leading label.
 */
export function resolveConsumerName(returnTo: string): string {
  let host: string;
  try {
    host = new URL(returnTo).hostname;
  } catch {
    return "the requesting app";
  }

  let websiteHost: string | undefined;
  try {
    websiteHost = new URL(config.meta.links.website).hostname;
  } catch {
    websiteHost = undefined;
  }

  if (host === websiteHost || host.startsWith("www.")) return "Createrington";

  const label = host.split(".")[0] ?? host;
  return (
    KNOWN_SUBDOMAIN_NAMES[label] ??
    label.charAt(0).toUpperCase() + label.slice(1)
  );
}
