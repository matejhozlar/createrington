import { z } from "zod";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  CurseForgeHashAlgo,
  CurseForgeModLoaderType,
  CurseForgeRelationType,
  CurseForgeSortField as CurseForgeSortFields,
  curseforgeFileSchema,
  curseforgeList,
  curseforgeLogoSchema,
  type CurseForgeAnswer,
  type CurseForgeRequest,
} from "@createrington/content-gateway-client";
import config from "@/config";
import { contentGateway, currentContentPool } from "@/services/content-gateway";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";

export const CurseForgeClass = CURSEFORGE_CLASSES;

export const CurseForgeLoader = {
  forge: CurseForgeModLoaderType.forge,
  fabric: CurseForgeModLoaderType.fabric,
  quilt: CurseForgeModLoaderType.quilt,
  neoforge: CurseForgeModLoaderType.neoForge,
} as const;

export const CurseForgeSortField = {
  popularity: CurseForgeSortFields.popularity,
  lastUpdated: CurseForgeSortFields.lastUpdated,
  totalDownloads: CurseForgeSortFields.totalDownloads,
  releasedDate: CurseForgeSortFields.releasedDate,
} as const;

export function parseCfResponse<T extends z.ZodType>(
  schema: T,
  body: unknown,
  endpoint: string,
): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    logger.warn(
      `CurseForge ${endpoint} response shape mismatch: ${parsed.error.message}`,
    );
    throw new Error(`CurseForge ${endpoint} returned an unexpected response`);
  }
  return parsed.data;
}

export const searchHitSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  summary: z.string().nullish(),
  authors: z.array(z.looseObject({ name: z.string() })).nullish(),
  downloadCount: z.number().nullish(),
  links: z.looseObject({ websiteUrl: z.string() }),
  logo: curseforgeLogoSchema.nullish(),
});

type RawLogo = z.infer<typeof curseforgeLogoSchema> | null | undefined;
type RawHashes = z.infer<typeof curseforgeFileSchema>["hashes"];

export function logoUrlOf(logo: RawLogo): string | null {
  return logo?.thumbnailUrl || logo?.url || null;
}

export function sha1Of(hashes: RawHashes): string | null {
  const sha1 = hashes?.find(
    (hash) => hash.algo === CurseForgeHashAlgo.sha1,
  )?.value;
  return sha1 ? sha1.toLowerCase() : null;
}

export function isDependency(dependency: { relationType: number }): boolean {
  return (
    dependency.relationType === CurseForgeRelationType.optionalDependency ||
    dependency.relationType === CurseForgeRelationType.requiredDependency
  );
}

export const MINECRAFT_GAME_ID = CURSEFORGE_MINECRAFT_GAME_ID;
export const MOD_CLASS_ID: number = CurseForgeClass.mods;
export const NEOFORGE_LOADER_TYPE: number = CurseForgeLoader.neoforge;
export const DEFAULT_GAME_VERSION: string =
  config.curseforge.defaultGameVersion;
export const MODPACK_PROJECT_ID: number = config.curseforge.modpackProjectId;

/**
 * Sends one request to the CurseForge API through the content gateway, which
 * holds the key, counts the call against the pool the caller is in and
 * answers from its cache while it can, and returns what CurseForge answered.
 * The gateway's own refusals (the budget of the minute spent, CurseForge
 * holding the key off after a 429, a timeout upstream) throw as
 * `ContentGatewayError`. File downloads from the CDN are not calls to the API
 * and do not come through here.
 */
export async function cfFetch(
  path: string,
  request: CurseForgeRequest = {},
): Promise<CurseForgeAnswer> {
  return contentGateway().curseforge(path, {
    pool: currentContentPool(),
    ...request,
  });
}

export function answerText(answer: CurseForgeAnswer): string {
  if (answer.body === null) return "";
  return typeof answer.body === "string"
    ? answer.body
    : JSON.stringify(answer.body);
}

const ID_ENDPOINTS = {
  mods: { path: "mods", idsKey: "modIds" },
  files: { path: "mods/files", idsKey: "fileIds" },
} as const;

/**
 * Posts ids to one of the batch endpoints and returns every row CurseForge
 * answers; the gateway splits the ids CurseForge has to be asked about into
 * calls of 100. CurseForge answers a request of which it knows no id with a
 * 404 and no body, not with an empty list, so that counts as no rows; any
 * other failure throws `<failure> (<status>)`.
 */
export async function postIds<T extends z.ZodType>(request: {
  of: keyof typeof ID_ENDPOINTS;
  ids: number[];
  row: T;
  endpoint: string;
  failure: string;
}): Promise<z.infer<T>[]> {
  if (request.ids.length === 0) return [];
  const { path, idsKey } = ID_ENDPOINTS[request.of];

  const answer = await cfFetch(path, { body: { [idsKey]: request.ids } });
  if (answer.status === 404) return [];
  if (!answer.ok) {
    throw new Error(
      `${request.failure} (${answer.status}): ${answerText(answer)}`,
    );
  }
  return parseCfResponse(
    curseforgeList(request.row),
    answer.body,
    request.endpoint,
  ).data;
}

export type RawFile = z.infer<typeof curseforgeFileSchema>;
