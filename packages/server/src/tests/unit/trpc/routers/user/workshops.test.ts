import { describe, it, expect, vi, beforeEach } from "vitest";

const { workshopServiceMock } = vi.hoisted(() => ({
  workshopServiceMock: {
    getVisibleWorkshopBySlug: vi.fn(),
    getWorkshopMods: vi.fn(),
    getModDetail: vi.fn(),
    getRejectedMods: vi.fn(),
  },
}));

vi.mock("@/services/workshop", () => ({
  workshopService: workshopServiceMock,
}));

vi.mock("@/db", () => ({}));

vi.mock("@/services/discord/oauth/oauth.service", async () => ({
  AuthRole: (
    await vi.importActual<typeof import("@createrington/shared/auth")>(
      "@createrington/shared/auth",
    )
  ).AuthRole,
}));

vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn() },
}));

vi.mock("@/services/workshop/bans", () => ({ findSuggestBan: vi.fn() }));

vi.mock("@/services/feature-flag", () => ({
  featureFlagService: { isEnabled: vi.fn().mockResolvedValue(true) },
  FeatureFlags: { workshop: "workshop" },
}));

vi.mock("@/trpc/middleware/rate-limit", async () => {
  const { middleware } =
    await vi.importActual<typeof import("@/trpc/trpc")>("@/trpc/trpc");
  return { createRateLimit: () => middleware(({ next }) => next()) };
});

import { userWorkshopsRouter } from "@/trpc/routers/user/workshops";
import { AuthRole } from "@createrington/shared/auth";
import type { Context } from "@/trpc/context";

const VIEWER_ID = "100000000000000001";
const OTHER_ID = "100000000000000002";
const SUBMITTER_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeMod(submittedBy: string) {
  return {
    id: 1,
    workshopId: 1,
    submittedBy,
    submitterName: "steve",
    submitterUuid: SUBMITTER_UUID,
    reviewedBy: "100000000000000003",
    reviewedAt: new Date(),
    reviewerName: "admin",
    discordThreadId: "100000000000000004",
  };
}

const caller = userWorkshopsRouter.createCaller({
  user: { discordId: VIEWER_ID, role: AuthRole.USER, isAdmin: false },
  service: null,
  ip: "127.0.0.1",
} as unknown as Context);

beforeEach(() => {
  workshopServiceMock.getVisibleWorkshopBySlug.mockResolvedValue({
    id: 1,
    createdBy: OTHER_ID,
    discordForumChannelId: null,
  });
  workshopServiceMock.getWorkshopMods.mockResolvedValue([
    makeMod(VIEWER_ID),
    makeMod(OTHER_ID),
  ]);
  workshopServiceMock.getModDetail.mockResolvedValue({
    mod: makeMod(OTHER_ID),
    project: {},
    upvoteCount: 0,
  });
  workshopServiceMock.getRejectedMods.mockResolvedValue([makeMod(OTHER_ID)]);
});

describe("user.workshops mod redaction", () => {
  it("returns the submitter's name and uuid and whether the viewer suggested it", async () => {
    const { mods } = await caller.get({ slug: "pack" });

    expect(mods.map((m) => m.submittedByMe)).toEqual([true, false]);
    expect(mods[1]).toMatchObject({
      submitterName: "steve",
      submitterUuid: SUBMITTER_UUID,
    });
  });

  it.each([
    ["get", async () => (await caller.get({ slug: "pack" })).mods[0]],
    ["getMod", async () => (await caller.getMod({ workshopModId: 1 })).mod],
    [
      "listRejected",
      async () => (await caller.listRejected({ workshopId: 1 }))[0],
    ],
  ])("%s leaves out Discord ids and reviewer fields", async (_name, load) => {
    const mod = await load();

    expect(Object.keys(mod).sort()).toEqual(
      [
        "id",
        "submittedByMe",
        "submitterName",
        "submitterUuid",
        "workshopId",
      ].sort(),
    );
  });
});
