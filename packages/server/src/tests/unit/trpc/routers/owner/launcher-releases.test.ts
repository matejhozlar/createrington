import { describe, it, expect, vi, beforeEach } from "vitest";

const { Q, isEnabled, OWNER_ID } = vi.hoisted(() => ({
  Q: { launcher: { release: { findAll: vi.fn(), count: vi.fn() } } },
  isEnabled: vi.fn(),
  OWNER_ID: "100000000000000009",
}));

vi.mock("@/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  const { app, launcher } = actual.default;
  return {
    ...actual,
    default: {
      ...actual.default,
      launcher: { ...launcher, available: true, channel: "staging" },
      app: {
        ...app,
        auth: {
          ...app.auth,
          owner: { ...app.auth.owner, discordId: OWNER_ID },
        },
      },
    },
  };
});
vi.mock("@/db", () => ({ Q }));
vi.mock("@/services/launcher/release/launcher-release.service", () => ({
  launcherReleaseService: { isEnabled },
}));

import type { LauncherRelease } from "@createrington/shared/db/launcher_release.types";
import { ilikeContains } from "@/db/utils";
import { ownerLauncherReleasesRouter } from "@/trpc/routers/owner/launcher-releases";
import { adminContext } from "@/tests/helpers/trpc";

const WINDOWS = "windows-x86_64";

const owner = ownerLauncherReleasesRouter.createCaller(
  adminContext({
    discordId: OWNER_ID,
    username: "owner",
    minecraftUsername: "Owner",
  }),
);

function release(overrides: Partial<LauncherRelease> = {}): LauncherRelease {
  return {
    id: 7,
    version: "0.3.0",
    platform: WINDOWS,
    url: "https://gitea.example.com/packages/launcher/0.3.0/setup.exe",
    signature: "signature-of-0.3.0",
    size: null,
    notes: "Notes for 0.3.0",
    structuredNotes: null,
    pubDate: new Date("2026-09-29T18:00:00Z"),
    status: "released",
    required: true,
    createdAt: new Date("2026-09-29T18:05:00Z"),
    releasedAt: new Date("2026-09-30T09:00:00Z"),
    releasedByDiscordId: OWNER_ID,
    withdrawnAt: null,
    withdrawnByDiscordId: null,
    prunedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Q.launcher.release.findAll.mockResolvedValue([]);
  Q.launcher.release.count.mockResolvedValue(0);
  isEnabled.mockReturnValue(true);
});

describe("owner.launcherReleases.list", () => {
  it("reads one page of the platform, newest publish first", async () => {
    await owner.list({ platform: WINDOWS, page: 2, limit: 10 });

    expect(Q.launcher.release.findAll).toHaveBeenCalledWith(
      { platform: WINDOWS, status: undefined, version: undefined },
      { orderBy: "createdAt", orderDirection: "desc", limit: 10, offset: 20 },
    );
  });

  it("starts at the first page of 20 when no page is asked for", async () => {
    await owner.list({ platform: WINDOWS });

    expect(Q.launcher.release.findAll.mock.calls[0][1]).toMatchObject({
      limit: 20,
      offset: 0,
    });
  });

  it("filters by status and by a part of the version", async () => {
    await owner.list({ platform: WINDOWS, status: "pruned", search: " 0.3 " });

    expect(Q.launcher.release.findAll.mock.calls[0][0]).toEqual({
      platform: WINDOWS,
      status: "pruned",
      version: ilikeContains("0.3"),
    });
  });

  it("counts with the same filters as the page", async () => {
    await owner.list({ platform: WINDOWS, status: "pending", search: "0.4" });

    expect(Q.launcher.release.count.mock.calls[0][0]).toBe(
      Q.launcher.release.findAll.mock.calls[0][0],
    );
  });

  it("returns the page with its pagination, the channel and whether publishing is on", async () => {
    Q.launcher.release.findAll.mockResolvedValue([
      release(),
      release({
        id: 6,
        version: "0.2.0",
        status: "pruned",
        required: false,
        prunedAt: new Date("2026-10-02T12:00:00Z"),
      }),
    ]);
    Q.launcher.release.count.mockResolvedValue(41);
    isEnabled.mockReturnValue(false);

    const result = await owner.list({ platform: WINDOWS, page: 1, limit: 20 });

    expect(result).toEqual({
      channel: "staging",
      enabled: false,
      items: [
        {
          id: 7,
          version: "0.3.0",
          platform: WINDOWS,
          url: "https://gitea.example.com/packages/launcher/0.3.0/setup.exe",
          notes: "Notes for 0.3.0",
          status: "released",
          required: true,
          pubDate: "2026-09-29T18:00:00.000Z",
          createdAt: "2026-09-29T18:05:00.000Z",
          releasedAt: "2026-09-30T09:00:00.000Z",
          withdrawnAt: null,
          prunedAt: null,
        },
        expect.objectContaining({
          id: 6,
          version: "0.2.0",
          status: "pruned",
          prunedAt: "2026-10-02T12:00:00.000Z",
        }),
      ],
      pagination: { page: 1, limit: 20, total: 41, totalPages: 3 },
    });
  });

  it.each([
    ["an unknown platform", { platform: "macos-aarch64" }],
    ["an unknown status", { platform: WINDOWS, status: "deleted" }],
    ["no platform", {}],
  ])("refuses %s without reading", async (_label, input) => {
    await expect(owner.list(input as never)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(Q.launcher.release.findAll).not.toHaveBeenCalled();
    expect(Q.launcher.release.count).not.toHaveBeenCalled();
  });
});
