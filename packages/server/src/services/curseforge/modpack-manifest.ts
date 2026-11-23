import JSZip from "jszip";
import { errorMessage } from "@/errors";
import { z } from "zod";
import { downloadCapped } from "@/utils/http";
import { parseCfResponse } from "./client";
import { CF_DOWNLOAD_TIMEOUT_MS, getModFileDownloadUrl } from "./downloads";
import {
  getLatestListedModpackFile,
  getModpackFile,
  manifestDisabledModIds,
  mergeManifestFiles,
  resolveModpackRelease,
  type ModpackManifest,
  type ModpackReadContext,
} from "./modpack";

const MAX_MODPACK_ZIP_BYTES = 256 * 1024 * 1024;

export interface ModpackManifestRead {
  manifest: ModpackManifest;
  complete: boolean;
}

export async function readModpackManifest(
  packProjectId: number,
  context: ModpackReadContext,
  options: { fresh?: boolean } = {},
): Promise<ModpackManifestRead> {
  const fresh = options.fresh === true;
  const listed = await getLatestListedModpackFile(packProjectId, fresh);
  const { file, serverPackFileId, complete } = await resolveModpackRelease(
    listed,
    context,
    (fileId) => getModpackFile(packProjectId, fileId, { fresh }),
  );

  const client = await downloadPackManifest(packProjectId, file.id);
  const server =
    serverPackFileId === null
      ? null
      : await downloadPackManifest(packProjectId, serverPackFileId);

  const loaders = client.minecraft?.modLoaders ?? [];
  const files = mergeManifestFiles(client.files, server?.files ?? null);
  const result: ModpackManifest = {
    fileId: file.id,
    serverPackFileId,
    displayName: file.displayName,
    version: client.version ?? null,
    minecraftVersion: client.minecraft?.version ?? null,
    modLoader: (loaders.find((l) => l.primary) ?? loaders[0])?.id ?? null,
    publishedAt: file.fileDate,
    entries: files.flatMap((f) =>
      f.fileId === undefined
        ? []
        : [
            {
              projectId: f.projectId,
              fileId: f.fileId,
              required: f.required,
              sides: f.sides,
            },
          ],
    ),
    modIds: new Set(files.map((f) => f.projectId)),
    disabledModIds: manifestDisabledModIds(files),
  };
  logger.info(
    `Read modpack mod list: ${result.modIds.size} mods from file ${file.id}` +
      (listed?.id === file.id ? "" : " (reported by the sandbox)") +
      (serverPackFileId === null
        ? complete
          ? ""
          : " without the server pack the pack ships"
        : ` and server pack ${serverPackFileId}`),
  );

  return { manifest: result, complete };
}

const packManifestSchema = z.object({
  version: z.string().optional(),
  minecraft: z
    .object({
      version: z.string().optional(),
      modLoaders: z
        .array(z.object({ id: z.string(), primary: z.boolean().optional() }))
        .optional(),
    })
    .optional(),
  files: z.array(
    z.object({
      projectID: z.number(),
      fileID: z.number().optional(),
      required: z.boolean().optional(),
    }),
  ),
});

async function downloadPackManifest(packProjectId: number, fileId: number) {
  const downloadUrl = await getModFileDownloadUrl(packProjectId, fileId);

  let body: Buffer;
  try {
    body = await downloadCapped(downloadUrl, {
      timeoutMs: CF_DOWNLOAD_TIMEOUT_MS,
      maxBytes: MAX_MODPACK_ZIP_BYTES,
    });
  } catch (error) {
    const reason = errorMessage(error);
    throw new Error(`Failed to download modpack file ${fileId}: ${reason}`, {
      cause: error,
    });
  }
  const zip = await JSZip.loadAsync(body);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error(`No manifest.json in modpack file ${fileId}`);
  }

  const manifest = parseCfResponse(
    packManifestSchema,
    JSON.parse(await manifestFile.async("text")),
    "modpack manifest",
  );
  return {
    version: manifest.version,
    minecraft: manifest.minecraft,
    files: manifest.files.map((f) => ({
      projectId: f.projectID,
      fileId: f.fileID,
      required: f.required ?? true,
    })),
  };
}
