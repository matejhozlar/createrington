import { vi } from "vitest";

type MockFactory = () =>
  Record<string, unknown> | Promise<Record<string, unknown>>;

export const curseforgeMocks: Record<
  "mods" | "files" | "modpack" | "modpackManifest" | "downloads" | "ingest",
  MockFactory
> = {
  mods: async () => ({
    ...(await vi.importActual<typeof import("@/services/curseforge/mods")>(
      "@/services/curseforge/mods",
    )),
    getMod: vi.fn(async () => {
      throw new Error("getMod must not be called in this suite");
    }),
    getMods: vi.fn(async () => []),
    searchMods: vi.fn(async () => []),
  }),
  files: async () => ({
    ...(await vi.importActual<typeof import("@/services/curseforge/files")>(
      "@/services/curseforge/files",
    )),
    getFilesDependencies: vi.fn(async () => []),
    getFilesDetails: vi.fn(async () => []),
    getServedFileIds: vi.fn(async (fileIds: number[]) => new Set(fileIds)),
  }),
  modpack: async () => ({
    ...(await vi.importActual<typeof import("@/services/curseforge/modpack")>(
      "@/services/curseforge/modpack",
    )),
    getModpackFile: vi.fn(async () => null),
  }),
  modpackManifest: async () => ({
    ...(await vi.importActual<typeof import("@/services/modpack/manifest")>(
      "@/services/modpack/manifest",
    )),
    getModpackManifest: vi.fn(async () => ({
      fileId: 1,
      serverPackFileId: null,
      displayName: null,
      version: null,
      minecraftVersion: null,
      modLoader: null,
      publishedAt: null,
      entries: [],
      modIds: new Set<number>(),
      disabledModIds: new Set<number>(),
    })),
    getModpackModIds: vi.fn(async () => new Set<number>()),
    findModpackModIds: vi.fn(async () => new Set<number>()),
  }),
  downloads: async () => ({
    ...(await vi.importActual<typeof import("@/services/curseforge/downloads")>(
      "@/services/curseforge/downloads",
    )),
    resolveFileDownloads: vi.fn(async () => new Map()),
  }),
  ingest: () => ({
    ingestProjects: vi.fn(),
    ingestProjectsWhere: vi.fn(async () => 0),
    refreshProjects: vi.fn(async () => 0),
  }),
};
