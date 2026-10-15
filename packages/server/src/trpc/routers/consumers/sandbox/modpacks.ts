import { z } from "zod";
import { router, adminProcedure, sandboxServiceProcedure } from "@/trpc/trpc";
import { id, rethrowTrpc } from "@/trpc/utils";
import { modpackService } from "@/services/modpack";
import type { ModpackModListItem } from "@/services/modpack";
import {
  LAUNCHER_PACK_SLUG_MAX_LENGTH,
  LAUNCHER_PACK_SLUG_PATTERN,
} from "@createrington/shared/launcher";
import type {
  ModEnvironment,
  ModEnvironmentSource,
  ModpackModOrigin,
  ModpackPublish,
} from "@createrington/shared/db";

export interface SandboxModpackPublish {
  clientFileId: number;
  serverPackFileId: number | null;
  reportedAt: string;
  ingestedAt: string | null;
  lastError: string | null;
  notes: string | null;
}

export function toSandboxModpackPublish(
  publish: ModpackPublish,
): SandboxModpackPublish {
  return {
    clientFileId: publish.clientFileId,
    serverPackFileId: publish.serverPackFileId,
    reportedAt: publish.reportedAt.toISOString(),
    ingestedAt: publish.ingestedAt?.toISOString() ?? null,
    lastError: publish.lastError,
    notes: publish.notes,
  };
}

export interface SandboxPackModProject {
  id: number;
  classId: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;
  websiteUrl: string | null;
  primaryAuthor: string | null;
  environment: ModEnvironment;
  environmentSource: ModEnvironmentSource | null;
}

export interface SandboxPackMod {
  id: number;
  curseforgeProjectId: number;
  origin: ModpackModOrigin;
  workshopModId: number | null;
  project: SandboxPackModProject;
  file: { id: number; name: string | null; releaseType: number | null } | null;
  required: boolean;
  liveInVersion: string | null;
  liveAt: string | null;
}

function toSandboxPackMod(item: ModpackModListItem): SandboxPackMod {
  return {
    id: item.id,
    curseforgeProjectId: item.curseforgeProjectId,
    origin: item.origin,
    workshopModId: item.workshopModId,
    project: {
      id: item.project.id,
      classId: item.project.classId,
      name: item.project.name,
      slug: item.project.slug,
      thumbnailUrl: item.project.thumbnailUrl,
      websiteUrl: item.project.websiteUrl,
      primaryAuthor: item.project.primaryAuthor,
      environment: item.project.environment,
      environmentSource: item.project.environmentSource,
    },
    file:
      item.fileId === null
        ? null
        : {
            id: item.fileId,
            name: item.fileName,
            releaseType: item.fileReleaseType,
          },
    required: item.required,
    liveInVersion: item.liveInVersion,
    liveAt: item.liveAt?.toISOString() ?? null,
  };
}

/** Sandbox consumer modpacks router: what main says is in the published pack. */
export const sandboxModpacksRouter = router({
  listMods: adminProcedure
    .meta({
      description:
        "Lists the current members of a modpack as mirrored from its published CurseForge manifest, with the frozen file each one ships as and its environment. A manifest can list any CurseForge project class (see CURSEFORGE_CLASSES in @createrington/shared/workshop), so check project.classId before treating an entry as a mod: shaders (6552) and resource packs (12) install outside the mods folder and data packs (6945) belong to a world. required mirrors the manifest entry flag: false means the pack ships the mod disabled (the CurseForge app exports disabled profile mods that way), so keep it off the test server and write it back as required: false when exporting. Mods the latest publish dropped are omitted.",
    })
    .input(z.object({ modpackId: id() }))
    .query(async ({ input }) => {
      try {
        const items = await modpackService.getPackMods(input.modpackId, {
          liveOnly: true,
        });
        return { mods: items.map(toSandboxPackMod) };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  recordPublish: sandboxServiceProcedure
    .meta({
      description:
        "Reports a release the sandbox published to CurseForge: the client file and the server pack uploaded as its additional file, once both are served by CurseForge. The CurseForge API never links a server pack uploaded through it, so without this report the main app would read the client manifest alone and treat every server-side member as dropped. The pair is validated against CurseForge (both served, the server pack a child of the client file), stored, and a forced reconcile runs right away; a refused or failed reconcile comes back as error and stays on the report. Optional notes (max 10k chars) are stored with the report and appended to the Discord changelog announcement as raw markdown; they never go to CurseForge. A resend that omits notes keeps the stored ones, an empty string clears them. Idempotent per client file, safe to resend. Authenticates with the shared SANDBOX_SERVICE_TOKEN, not a user JWT.",
    })
    .input(
      z.object({
        projectId: id(),
        clientFileId: id(),
        serverPackFileId: id(),
        notes: z.string().trim().max(10_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await modpackService.recordPublish(input);
        return {
          ingested: result.ingested,
          error: result.error,
          publish: toSandboxModpackPublish(result.publish),
        };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),

  recordSnapshot: sandboxServiceProcedure
    .meta({
      description:
        "Reports a snapshot of a pack whose releases the sandbox provides (a launcher pack with source sandbox, named by its slug): the client pack zip the sandbox keeps under the snapshot id at GET /api/pack/files/snapshot/:id, with its SHA-1 and size, the Minecraft version and mod loader of its manifest, and every client file of the manifest as CurseForge project and file ids. The main app reads the zip back through its internal sandbox address and refuses the report when the bytes do not match; it then records the snapshot as a release keyed by the snapshot id, resolves the files for the launcher, and offers the snapshot as the pack's latest release while retiring every older snapshot. ready says whether the launcher can install it now; when it cannot, error says why and the report can be resent once the cause is fixed. Optional notes (max 10k chars) become the release's changelog notes; omitting them keeps stored ones, an empty string clears them. Idempotent per snapshot id. Authenticates with the shared SANDBOX_SERVICE_TOKEN, not a user JWT.",
    })
    .input(
      z.object({
        slug: z
          .string()
          .max(LAUNCHER_PACK_SLUG_MAX_LENGTH)
          .regex(LAUNCHER_PACK_SLUG_PATTERN),
        snapshotId: id(),
        version: z.string().trim().min(1).max(64),
        minecraftVersion: z.string().trim().min(1).max(32),
        modLoader: z.string().trim().min(1).max(64),
        zip: z.object({
          fileName: z.string().trim().min(1).max(255),
          size: z.number().int().positive(),
          sha1: z.string().regex(/^[0-9a-f]{40}$/),
        }),
        files: z
          .array(
            z.object({
              projectId: id(),
              fileId: id(),
              required: z.boolean().default(true),
            }),
          )
          .min(1)
          .max(2000),
        notes: z.string().trim().max(10_000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await modpackService.recordSnapshot(input);
        return {
          ready: result.ready,
          error: result.error,
          release: {
            id: result.release.id,
            snapshotId: result.release.curseforgeFileId,
            version: result.release.version,
            readyAt: result.release.launcherReadyAt?.toISOString() ?? null,
          },
        };
      } catch (error) {
        rethrowTrpc(error);
      }
    }),
});
