const CURSEFORGE_HOSTS = new Set(["curseforge.com", "www.curseforge.com"]);
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type ModUrlErrorReason = "not-curseforge" | "not-a-mod" | "missing-slug";

export type ParsedModUrl =
  { ok: true; slug: string } | { ok: false; reason: ModUrlErrorReason };

/** Extracts the mod slug from a curseforge.com mod page link. */
export function parseModUrl(input: string): ParsedModUrl {
  const raw = input.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "not-curseforge" };
  }

  if (!CURSEFORGE_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, reason: "not-curseforge" };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] !== "minecraft" || segments[1] !== "mc-mods") {
    return { ok: false, reason: "not-a-mod" };
  }

  const slug = segments[2]?.toLowerCase();
  if (!slug || !SLUG_PATTERN.test(slug)) {
    return { ok: false, reason: "missing-slug" };
  }

  return { ok: true, slug };
}
