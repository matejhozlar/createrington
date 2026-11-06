import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TopRoleView } from "@/services/discord/role/top-role-holder.service";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  renderCard: vi.fn(),
  paintLeaderboardsCard: vi.fn(),
  loadImage: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/services/discord/role/top-role-holder.service", () => ({
  topRoleHolderService: { list: mocks.list },
}));

vi.mock("@/utils/og-card", () => ({
  registerBrandFonts: vi.fn(),
  renderCard: mocks.renderCard,
}));

vi.mock("@/services/leaderboard/og-card.paint", () => ({
  SLOT_ORDER: ["the_sleepless", "the_unrivaled", "capitalist"],
  paintLeaderboardsCard: mocks.paintLeaderboardsCard,
}));

vi.mock("@napi-rs/canvas", () => ({ loadImage: mocks.loadImage }));

import { LeaderboardOgCardService } from "@/services/leaderboard/og-card.service";

const STORED = (key: string) => `https://r2.example/${key}.webp`;

function role(
  roleKey: string,
  holder: Partial<NonNullable<TopRoleView["holder"]>> | null = {},
): TopRoleView {
  return {
    roleKey,
    label: roleKey,
    metric: "playtime",
    pose: "zombie",
    holder: holder && {
      minecraftUuid: `uuid-${roleKey}`,
      minecraftUsername: `name-${roleKey}`,
      value: 100,
      heldSince: new Date("2026-09-01"),
      imageUrl: STORED(roleKey),
      outlineImageUrl: null,
      ...holder,
    },
  };
}

const ALL_ROLES = [
  role("the_sleepless"),
  role("the_unrivaled"),
  role("capitalist"),
];

let paints = 0;

beforeEach(() => {
  vi.clearAllMocks();
  paints = 0;
  mocks.list.mockResolvedValue(ALL_ROLES);
  mocks.renderCard.mockImplementation(async (paint) => {
    await paint({});
    return Buffer.from(`png-${++paints}`);
  });
  mocks.loadImage.mockImplementation(async (bytes: Buffer) => ({
    bytes: bytes.toString(),
  }));
  mocks.fetch.mockImplementation(async (url: string) => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(url).buffer,
  }));
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LeaderboardOgCardService", () => {
  it("serves the cached card while the holders are unchanged", async () => {
    const service = new LeaderboardOgCardService();

    const first = await service.render();
    const second = await service.render();

    expect(first.png.toString()).toBe("png-1");
    expect(second).toBe(first);
    expect(first.degraded).toBe(false);
    expect(mocks.renderCard).toHaveBeenCalledTimes(1);
  });

  it("repaints when a holder's metric moves", async () => {
    const service = new LeaderboardOgCardService();
    await service.render();

    mocks.list.mockResolvedValue([
      role("the_sleepless", { value: 200 }),
      role("the_unrivaled"),
      role("capitalist"),
    ]);
    const card = await service.render();

    expect(card.png.toString()).toBe("png-2");
  });

  it("shares one paint between concurrent requests", async () => {
    const service = new LeaderboardOgCardService();

    const [a, b, c] = await Promise.all([
      service.render(),
      service.render(),
      service.render(),
    ]);

    expect(mocks.renderCard).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("drops a failed paint so the next request retries", async () => {
    const service = new LeaderboardOgCardService();
    mocks.renderCard.mockRejectedValueOnce(new Error("canvas exploded"));

    await expect(service.render()).rejects.toThrow("canvas exploded");
    const card = await service.render();

    expect(card.png.toString()).toBe("png-1");
    expect(mocks.renderCard).toHaveBeenCalledTimes(2);
  });

  it("flags a card painted from a fallback figure and repaints it once the retry delay passes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const service = new LeaderboardOgCardService();
    mocks.fetch.mockImplementationOnce(async () => {
      throw new Error("R2 timeout");
    });

    const degraded = await service.render();
    expect(degraded.degraded).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://mc-heads.net/body/uuid-the_sleepless/600",
      expect.anything(),
    );

    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(await service.render()).toBe(degraded);

    vi.advanceTimersByTime(2 * 60 * 1000);
    const healed = await service.render();
    expect(healed.degraded).toBe(false);
    expect(healed.png.toString()).toBe("png-2");
  });

  it("flags a card with a holder whose figure could not be loaded at all", async () => {
    const service = new LeaderboardOgCardService();
    mocks.fetch.mockResolvedValue({ ok: false, status: 503 });

    const card = await service.render();

    expect(card.degraded).toBe(true);
    const slots = mocks.paintLeaderboardsCard.mock.calls[0][1];
    expect(slots[0].holder.figure).toBeNull();
  });

  it("does not flag the mc-heads body of a holder that has no stored figure", async () => {
    const service = new LeaderboardOgCardService();
    mocks.list.mockResolvedValue([
      role("the_sleepless", { imageUrl: null }),
      role("the_unrivaled"),
      role("capitalist", null),
    ]);

    const card = await service.render();

    expect(card.degraded).toBe(false);
  });

  it("keeps every title in its own slot when a configured role is missing", async () => {
    const service = new LeaderboardOgCardService();
    mocks.list.mockResolvedValue([role("capitalist"), role("the_sleepless")]);

    await service.render();

    const slots = mocks.paintLeaderboardsCard.mock.calls[0][1];
    expect(
      slots.map((slot: { roleKey: string } | null) => slot?.roleKey),
    ).toEqual(["the_sleepless", undefined, "capitalist"]);
  });
});
