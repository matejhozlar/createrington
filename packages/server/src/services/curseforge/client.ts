import { z } from "zod";
import {
  CURSEFORGE_MINECRAFT_GAME_ID,
  CurseForgeHashAlgo,
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
import { CurseForgeLoader } from "./loader";

export const CurseForgeClass = CURSEFORGE_CLASSES;

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

function failure(endpoint: string, answer: CurseForgeAnswer): Error {
  return new Error(
    `CurseForge ${endpoint} failed (${answer.status}): ${answerText(answer)}`,
  );
}

/**
 * Asks CurseForge for one path and returns its answer parsed by `schema`.
 * Any answer that is not ok throws `CurseForge <endpoint> failed (<status>)`,
 * except a 404 with `notFound: "null"`, which resolves to null.
 */
export async function cfRead<T extends z.ZodType>(
  path: string,
  request: CurseForgeRequest,
  schema: T,
  endpoint: string,
  options: { notFound: "null" },
): Promise<z.infer<T> | null>;
export async function cfRead<T extends z.ZodType>(
  path: string,
  request: CurseForgeRequest,
  schema: T,
  endpoint: string,
): Promise<z.infer<T>>;
export async function cfRead<T extends z.ZodType>(
  path: string,
  request: CurseForgeRequest,
  schema: T,
  endpoint: string,
  options: { notFound?: "null" } = {},
): Promise<z.infer<T> | null> {
  const answer = await cfFetch(path, request);
  if (options.notFound === "null" && answer.status === 404) return null;
  if (!answer.ok) throw failure(endpoint, answer);
  return parseCfResponse(schema, answer.body, endpoint);
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
 * other failure throws `CurseForge <endpoint> failed (<status>)`.
 */
export async function postIds<T extends z.ZodType>(request: {
  of: keyof typeof ID_ENDPOINTS;
  ids: number[];
  row: T;
  endpoint: string;
}): Promise<z.infer<T>[]> {
  if (request.ids.length === 0) return [];
  const { path, idsKey } = ID_ENDPOINTS[request.of];

  const answer = await cfRead(
    path,
    { body: { [idsKey]: request.ids } },
    curseforgeList(request.row),
    request.endpoint,
    { notFound: "null" },
  );
  return answer?.data ?? [];
}

export interface CurseForgeFileDependency {
  projectId: number;
  relationType: number;
}

export interface CurseForgeFile {
  id: number;
  projectId: number;
  gameId: number | null;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  releaseType: number | null;
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
  gameVersions: string[];
  dependencies: CurseForgeFileDependency[];
  fileStatus: number | null;
  isAvailable: boolean;
  serverPackFileId: number | null;
  alternateFileId: number | null;
  parentProjectFileId: number | null;
  isServerPack: boolean;
}

export function toCurseForgeFile(
  raw: z.infer<typeof curseforgeFileSchema>,
): CurseForgeFile {
  return {
    id: raw.id,
    projectId: raw.modId,
    gameId: raw.gameId ?? null,
    displayName: raw.displayName ?? null,
    fileName: raw.fileName ?? null,
    fileDate: raw.fileDate ?? null,
    releaseType: raw.releaseType ?? null,
    downloadUrl: raw.downloadUrl || null,
    fileLength: raw.fileLength ?? null,
    sha1: sha1Of(raw.hashes),
    gameVersions: raw.gameVersions ?? [],
    dependencies: (raw.dependencies ?? [])
      .filter(isDependency)
      .map((dependency) => ({
        projectId: dependency.modId,
        relationType: dependency.relationType,
      })),
    fileStatus: raw.fileStatus ?? null,
    isAvailable: raw.isAvailable ?? true,
    serverPackFileId: raw.serverPackFileId ?? null,
    alternateFileId: raw.alternateFileId ?? null,
    parentProjectFileId: raw.parentProjectFileId ?? null,
    isServerPack: raw.isServerPack ?? false,
  };
}
