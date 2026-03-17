import config from "@/config";

const CURSEFORGE_API = "https://api.curseforge.com";
const MINECRAFT_GAME_ID = 432;
const NEOFORGE_LOADER_TYPE = 6;
const DEFAULT_GAME_VERSION = "1.21.1";

function cfHeaders(): Record<string, string> {
  return {
    "x-api-key": config.curseforge.apiKey!,
    Accept: "application/json",
  };
}

export interface CurseForgeSearchResult {
  id: number;
  name: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
}

export async function searchMods(
  query: string,
  pageSize = 20,
): Promise<CurseForgeSearchResult[]> {
  if (!config.curseforge.apiKey) {
    throw new Error("CurseForge API key not configured");
  }

  const url = new URL(`${CURSEFORGE_API}/v1/mods/search`);
  url.searchParams.set("gameId", String(MINECRAFT_GAME_ID));
  url.searchParams.set("searchFilter", query);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("classId", "6"); // mods only
  url.searchParams.set("modLoaderType", String(NEOFORGE_LOADER_TYPE));
  url.searchParams.set("gameVersion", DEFAULT_GAME_VERSION);

  const res = await fetch(url.toString(), { headers: cfHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CurseForge search failed (${res.status}): ${text}`);
  }

  const body = (await res.json()) as {
    data: Array<{
      id: number;
      name: string;
      slug: string;
      links: { websiteUrl: string };
      logo?: { thumbnailUrl: string };
    }>;
  };

  return body.data.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    url: m.links.websiteUrl,
    thumbnailUrl: m.logo?.thumbnailUrl,
  }));
}
