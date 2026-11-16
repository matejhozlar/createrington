import { vi } from "vitest";

export const launcherPackMocks = {
  sandboxFiles: async () => ({
    ...(await vi.importActual<
      typeof import("@/services/launcher/pack/sandbox-files")
    >("@/services/launcher/pack/sandbox-files")),
    findSandboxFileUrls: vi.fn(async () => new Map()),
    findSandboxSnapshotUrl: vi.fn(async () => null),
    openSandboxFile: vi.fn(async () => null),
  }),
  releaseService: () => ({
    launcherPackReleaseService: {
      prepareRelease: vi.fn(async () => undefined),
      prepareSnapshot: vi.fn(async () => undefined),
      checkReleases: vi.fn(async () => undefined),
    },
  }),
  minecraft: () => ({
    getMinecraftJavaMajorVersion: vi.fn(async () => 21),
  }),
};
