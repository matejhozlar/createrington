import config from "@/config";

export function siteUrl(path = ""): string {
  const base = (config.meta.links.website ?? "").replace(/\/+$/, "");
  if (!path) return base;
  return `${base}/${path.replace(/^\/+/, "")}`;
}
