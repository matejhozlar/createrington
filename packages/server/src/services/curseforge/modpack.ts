import {
  curseforgeData,
  curseforgeFileSchema,
  curseforgeList,
} from "@createrington/content-gateway-client";
import { cfFetch, parseCfResponse, sha1Of, type RawFile } from "./client";

/** Which of a release's manifests listed an entry. */
export type ModpackManifestSides = "client" | "server" | "both";

export interface ModpackManifestEntry {
  projectId: number;
  fileId: number;
  required: boolean;
  sides: ModpackManifestSides;
}

export interface ModpackManifest {
  /** The client pack file; identity of the release. */
  fileId: number;
  /** The server pack read alongside the client file, null when the release ships none. */
  serverPackFileId: number | null;
  displayName: string | null;
  version: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  publishedAt: string | null;
  entries: ModpackManifestEntry[];
  modIds: Set<number>;
  /** Projects the manifest ships only as not-required entries, i.e. disabled in the pack. */
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

/** One file of a modpack project as CurseForge describes it, server packs and additional files included. */
export interface ModpackFile {
  id: number;
  projectId: number;
  displayName: string | null;
  fileName: string | null;
  fileDate: string | null;
  downloadUrl: string | null;
  fileLength: number | null;
  sha1: string | null;
  fileStatus: number | null;
  isAvailable: boolean;
  serverPackFileId: number | null;
  alternateFileId: number | null;
  parentProjectFileId: number | null;
  isServerPack: boolean;
}

/** A release the sandbox reported after publishing it: the client file and the server pack it uploaded. */
export interface ModpackPublishHint {
  clientFileId: number;
  serverPackFileId: number | null;
}

/** What the database knows about a pack that shapes how its newest release is read. */
export interface ModpackReadContext {
  shipsServerPack: boolean;
  publishes: ModpackPublishHint[];
}

export interface ModpackReleaseResolution {
  file: ModpackFile;
  serverPackFileId: number | null;
  /** False when the pack ships a server pack and this read found none. */
  complete: boolean;
}

function toModpackFile(raw: RawFile): ModpackFile {
  return {
    id: raw.id,
    projectId: raw.modId,
    displayName: raw.displayName ?? null,
    fileName: raw.fileName ?? null,
    fileDate: raw.fileDate ?? null,
    downloadUrl: raw.downloadUrl || null,
    fileLength: raw.fileLength ?? null,
    sha1: sha1Of(raw.hashes),
    fileStatus: raw.fileStatus ?? null,
    isAvailable: raw.isAvailable ?? true,
    serverPackFileId: raw.serverPackFileId ?? null,
    alternateFileId: raw.alternateFileId ?? null,
    parentProjectFileId: raw.parentProjectFileId ?? null,
    isServerPack: raw.isServerPack ?? false,
  };
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
): Promise<ModpackFile | null> {
  const answer = await cfFetch(`mods/${packProjectId}/files/${fileId}`, {
    fresh: options.fresh,
  });
  if (answer.status === 404) return null;
  if (!answer.ok) {
    throw new Error(
      `Failed to fetch modpack file ${fileId} (${answer.status})`,
    );
  }
  const body = parseCfResponse(
    curseforgeData(curseforgeFileSchema),
    answer.body,
    "getModpackFile",
  );
  return toModpackFile(body.data);
}

const RECENT_PUBLISHES = 5;

export async function getLatestListedModpackFile(
  packProjectId: number,
  fresh: boolean,
): Promise<ModpackFile | null> {
  const answer = await cfFetch(`mods/${packProjectId}/files`, {
    query: { pageSize: 1 },
    fresh,
  });
  if (!answer.ok) {
    throw new Error(`Failed to fetch modpack files (${answer.status})`);
  }
  const body = parseCfResponse(
    curseforgeList(curseforgeFileSchema),
    answer.body,
    "getModpackFiles",
  );
  const latest = body.data[0];
  return latest ? toModpackFile(latest) : null;
}

// Lazy so this module stays importable without a database (unit tests, scripts)
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
  listed: ModpackFile | null,
  context: ModpackReadContext,
  readFile: (fileId: number) => Promise<ModpackFile | null>,
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
