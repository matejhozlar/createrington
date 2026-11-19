import {
  curseforgeData,
  curseforgeFileSchema,
  curseforgeList,
} from "@createrington/content-gateway-client";
import { cfRead, toCurseForgeFile, type CurseForgeFile } from "./client";

export type ModpackManifestSides = "client" | "server" | "both";

export interface ModpackManifestEntry {
  projectId: number;
  fileId: number;
  required: boolean;
  sides: ModpackManifestSides;
}

export interface ModpackManifest {
  fileId: number;
  serverPackFileId: number | null;
  displayName: string | null;
  version: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  publishedAt: string | null;
  entries: ModpackManifestEntry[];
  modIds: Set<number>;
  disabledModIds: Set<number>;
}

/**
 * Projects whose every manifest entry carries required: false, which is how
 * the CurseForge app exports mods disabled in a profile
 */
export function manifestDisabledModIds(
  files: Array<{ projectId: number; required: boolean }>,
): Set<number> {
  const requiredByProject = new Map<number, boolean>();
  for (const file of files) {
    requiredByProject.set(
      file.projectId,
      (requiredByProject.get(file.projectId) ?? false) || file.required,
    );
  }
  return new Set(
    [...requiredByProject].flatMap(([projectId, required]) =>
      required ? [] : [projectId],
    ),
  );
}

/**
 * Union of a release's client and server manifests, client entries first.
 * A project the server manifest repeats is not listed again; it marks the
 * client entry as shipping to both sides, and the client entry's file and
 * required flag win (the sandbox writes both manifests from one plan, so
 * they agree). Without a server pack every entry is client-side by
 * definition
 */
export function mergeManifestFiles<T extends { projectId: number }>(
  client: T[],
  server: T[] | null,
): Array<T & { sides: ModpackManifestSides }> {
  if (server === null) {
    return client.map((file) => ({ ...file, sides: "client" as const }));
  }
  const clientProjects = new Set(client.map((file) => file.projectId));
  const serverProjects = new Set(server.map((file) => file.projectId));
  return [
    ...client.map((file) => ({
      ...file,
      sides: serverProjects.has(file.projectId)
        ? ("both" as const)
        : ("client" as const),
    })),
    ...server
      .filter((file) => !clientProjects.has(file.projectId))
      .map((file) => ({ ...file, sides: "server" as const })),
  ];
}

export interface ModpackPublishHint {
  clientFileId: number;
  serverPackFileId: number | null;
}

export interface ModpackReadContext {
  shipsServerPack: boolean;
  publishes: ModpackPublishHint[];
}

export interface ModpackReleaseResolution {
  file: CurseForgeFile;
  serverPackFileId: number | null;
  complete: boolean;
}

/**
 * One file of a modpack project by id. Unlike the files listing this also
 * serves server packs and additional files. Null when CurseForge does not
 * serve the file (unknown, not approved yet, or archived). `fresh` asks
 * CurseForge again instead of the gateway's cache.
 */
export async function getModpackFile(
  packProjectId: number,
  fileId: number,
  options: { fresh?: boolean } = {},
): Promise<CurseForgeFile | null> {
  const body = await cfRead(
    `mods/${packProjectId}/files/${fileId}`,
    { fresh: options.fresh },
    curseforgeData(curseforgeFileSchema),
    "getModpackFile",
    { notFound: "null" },
  );
  return body ? toCurseForgeFile(body.data) : null;
}

const RECENT_PUBLISHES = 5;

export async function getLatestListedModpackFile(
  packProjectId: number,
  fresh: boolean,
): Promise<CurseForgeFile | null> {
  const body = await cfRead(
    `mods/${packProjectId}/files`,
    { query: { pageSize: 1 }, fresh },
    curseforgeList(curseforgeFileSchema),
    "getModpackFiles",
  );
  const latest = body.data[0];
  return latest ? toCurseForgeFile(latest) : null;
}

export async function loadModpackReadContext(
  packProjectId: number,
): Promise<ModpackReadContext> {
  const { Q } = await import("@/db/index.js");
  const modpack = await Q.modpack.find({ curseforgeProjectId: packProjectId });
  if (!modpack) return { shipsServerPack: false, publishes: [] };
  const publishes = await Q.modpack.publish.findAll(
    { modpackId: modpack.id },
    {
      select: ["clientFileId", "serverPackFileId"],
      orderBy: "clientFileId",
      orderDirection: "desc",
      limit: RECENT_PUBLISHES,
    },
  );
  return {
    shipsServerPack: modpack.shipsServerPack,
    publishes: publishes.map((publish) => ({
      clientFileId: publish.clientFileId,
      serverPackFileId: publish.serverPackFileId,
    })),
  };
}

/**
 * Decide which file is the pack's newest release and which server pack goes
 * with it. The listing's newest file is the release unless the sandbox
 * reported a newer client file that CurseForge already serves by id (the
 * listing is cached per URL on their side and lags behind). The server pack
 * is CurseForge's own link when it has one, else the alternate file when
 * that reads back as a server pack of this release, else what the sandbox
 * reported for the file. The API never links a server pack uploaded
 * through it, so for sandbox releases the report is the usual source.
 */
export async function resolveModpackRelease(
  listed: CurseForgeFile | null,
  context: ModpackReadContext,
  readFile: (fileId: number) => Promise<CurseForgeFile | null>,
): Promise<ModpackReleaseResolution> {
  const newest = context.publishes.reduce<ModpackPublishHint | null>(
    (held, publish) =>
      held === null || publish.clientFileId > held.clientFileId
        ? publish
        : held,
    null,
  );

  let file = listed;
  if (newest && (file === null || newest.clientFileId > file.id)) {
    const reported = await readFile(newest.clientFileId);
    if (reported?.isAvailable) file = reported;
  }
  if (file === null) throw new Error("No modpack files found");

  const publish =
    context.publishes.find((p) => p.clientFileId === file.id) ?? null;
  let serverPackFileId = file.serverPackFileId;
  if (serverPackFileId === null && file.alternateFileId !== null) {
    const alternate = await readFile(file.alternateFileId);
    if (alternate?.isServerPack && alternate.parentProjectFileId === file.id) {
      serverPackFileId = alternate.id;
    }
  }
  if (publish && publish.serverPackFileId !== null) {
    if (serverPackFileId === null) {
      serverPackFileId = publish.serverPackFileId;
    } else if (serverPackFileId !== publish.serverPackFileId) {
      logger.warn(
        `Modpack file ${file.id} links server pack ${serverPackFileId} on CurseForge but the sandbox reported ${publish.serverPackFileId}`,
      );
    }
  }

  return {
    file,
    serverPackFileId,
    complete: !context.shipsServerPack || serverPackFileId !== null,
  };
}
