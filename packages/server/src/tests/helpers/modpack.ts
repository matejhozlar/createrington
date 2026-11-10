import type {
  ModpackManifest,
  ModpackManifestSides,
} from "@/services/curseforge/modpack";

let manifestFileId = 0;

// Test project ids are ~992_000_000, so a derived file id has to stay in int4
export const fileIdFor = (projectId: number) => 700_000 + (projectId % 100_000);

export function manifest(
  overrides: Partial<Omit<ModpackManifest, "entries">> & {
    modIds?: Set<number>;
    disabledModIds?: Set<number>;
    entries?: Array<{
      projectId: number;
      fileId: number;
      required?: boolean;
      sides?: ModpackManifestSides;
    }>;
  } = {},
): ModpackManifest {
  const modIds = overrides.modIds ?? new Set<number>();
  const disabledModIds = overrides.disabledModIds ?? new Set<number>();
  const serverPackFileId = overrides.serverPackFileId ?? null;
  const entries: NonNullable<typeof overrides.entries> =
    overrides.entries ??
    [...modIds].map((projectId) => ({
      projectId,
      fileId: fileIdFor(projectId),
    }));
  return {
    fileId: ++manifestFileId,
    displayName: null,
    version: null,
    minecraftVersion: null,
    modLoader: null,
    publishedAt: null,
    ...overrides,
    serverPackFileId,
    entries: entries.map((entry) => ({
      ...entry,
      required: entry.required ?? !disabledModIds.has(entry.projectId),
      sides: entry.sides ?? (serverPackFileId === null ? "client" : "both"),
    })),
    modIds,
    disabledModIds,
  };
}

export function sidedManifest(
  version: string,
  sided: Array<[projectId: number, sides: ModpackManifestSides]>,
): ModpackManifest {
  const built = manifest({
    version,
    modIds: new Set(sided.map(([projectId]) => projectId)),
    entries: sided.map(([projectId, sides]) => ({
      projectId,
      fileId: fileIdFor(projectId),
      sides,
    })),
  });
  return { ...built, serverPackFileId: 800_000 + built.fileId };
}

export function requiredOf(
  rows: Array<{ curseforgeProjectId: number; required: boolean }>,
  projectId: number,
) {
  return rows.find((row) => row.curseforgeProjectId === projectId)?.required;
}
