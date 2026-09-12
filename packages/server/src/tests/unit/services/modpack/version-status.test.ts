import { describe, it, expect, beforeEach, vi } from "vitest";

type ReleaseRow = { id: number; version: string | null };

const state = vi.hoisted(() => ({
  modpack: null as { id: number; name: string } | null,
  releases: [] as ReleaseRow[],
}));

vi.mock("@/db", () => ({
  db: {},
  Q: {
    modpack: {
      find: async () => state.modpack,
      release: {
        findAll: async (filter: { version?: string }) =>
          filter.version === undefined
            ? [...state.releases].sort((a, b) => b.id - a.id).slice(0, 1)
            : [...state.releases]
                .filter((release) => release.version === filter.version)
                .sort((a, b) => b.id - a.id)
                .slice(0, 1),
      },
    },
  },
}));

import { NotFoundError } from "@/app/middleware/error-handler";
import { modpackService } from "@/services/modpack";

const PROJECT_ID = 1660984;

function status(installedVersion?: string) {
  return modpackService.getVersionStatus({
    curseforgeProjectId: PROJECT_ID,
    installedVersion,
  });
}

beforeEach(() => {
  state.modpack = { id: 7, name: "Vitest Pack" };
  state.releases = [
    { id: 1, version: "1.0.4" },
    { id: 2, version: "1.0.6" },
    { id: 3, version: "1.0.8" },
  ];
});

describe("modpackService.getVersionStatus", () => {
  it("reads an older recorded release as outdated", async () => {
    await expect(status("1.0.6")).resolves.toEqual({
      latest: "1.0.8",
      installed: "1.0.6",
      outdated: true,
    });
  });

  it("reads the newest release as current", async () => {
    await expect(status("1.0.8")).resolves.toEqual({
      latest: "1.0.8",
      installed: "1.0.8",
      outdated: false,
    });
  });

  it("reads an unrecorded but numerically lower version as outdated", async () => {
    await expect(status("1.0.1")).resolves.toEqual({
      latest: "1.0.8",
      installed: "1.0.1",
      outdated: true,
    });
  });

  it("reads an unrecorded newer or non-numeric version as current", async () => {
    for (const installed of ["1.1.0", "1.0.9-dev", "dev"]) {
      await expect(status(installed)).resolves.toMatchObject({
        installed,
        outdated: false,
      });
    }
  });

  it("never reads a numerically newer version as outdated, even when recorded later", async () => {
    state.releases = [
      { id: 1, version: "1.0.8" },
      { id: 2, version: "1.0.6" },
    ];

    await expect(status("1.0.8")).resolves.toEqual({
      latest: "1.0.6",
      installed: "1.0.8",
      outdated: false,
    });
  });

  it("reads a missing installed version as current", async () => {
    await expect(status()).resolves.toEqual({
      latest: "1.0.8",
      installed: null,
      outdated: false,
    });
  });

  it("rejects a pack with no recorded release", async () => {
    state.releases = [];

    await expect(status("1.0.6")).rejects.toThrow(
      /has no recorded release yet/,
    );
  });

  it("rejects a newest release that carries no version", async () => {
    state.releases = [{ id: 4, version: null }];

    await expect(status("1.0.6")).rejects.toThrow(
      /has no version recorded for its newest release/,
    );
  });

  it("rejects an unpublished pack", async () => {
    state.modpack = null;

    await expect(status("1.0.6")).rejects.toBeInstanceOf(NotFoundError);
  });
});
