import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const warning = vi.hoisted(() => ({
  resolveReturned: vi.fn(),
  getInactivePlayers: vi.fn(),
  createMany: vi.fn(),
  setMessageIdOnPending: vi.fn(),
  getExpiredWarnings: vi.fn(),
  pruneClosed: vi.fn(),
  update: vi.fn(),
}));
const settings = vi.hoisted(() => ({
  getInactivityCycleRanAt: vi.fn(),
  setInactivityCycleRanAt: vi.fn(),
}));
const messages = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@/db", () => ({
  Q: { player: { inactivity: { warning } } },
}));

vi.mock("@/services/settings", () => ({ settings }));

vi.mock("@/discord/constants", () => ({
  Discord: {
    Channels: {
      createringtonOfficial: { ANNOUNCEMENTS: "100" },
      administration: { NOTIFICATIONS: "200" },
    },
    Messages: messages,
  },
}));

vi.mock("@/discord/embeds", () => ({
  EmbedPresets: {
    inactivity: {
      warning: () => ({ build: () => [] }),
      removed: () => ({ build: () => [] }),
      adminRemoval: () => ({ build: () => [] }),
    },
  },
}));

vi.mock("@/services/discord/cleanup/inactivity/remove-warning", () => ({
  removeInactiveWarning: vi.fn(),
}));

const { InactivityCleanupService } =
  await import("@/services/discord/cleanup/inactivity/inactivity-cleanup.service");

const NOW = new Date("2026-11-25T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const INACTIVE_PLAYER = {
  minecraftUuid: "11111111-1111-4111-8111-111111111111",
  minecraftUsername: "hypevida",
};

describe("InactivityCleanupService schedule", () => {
  let service: InstanceType<typeof InactivityCleanupService>;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
    warning.resolveReturned.mockReset().mockResolvedValue([]);
    warning.getInactivePlayers.mockReset().mockResolvedValue([INACTIVE_PLAYER]);
    warning.createMany.mockReset().mockResolvedValue(undefined);
    warning.setMessageIdOnPending.mockReset().mockResolvedValue(undefined);
    warning.getExpiredWarnings.mockReset().mockResolvedValue([]);
    warning.pruneClosed.mockReset().mockResolvedValue(0);
    settings.getInactivityCycleRanAt.mockReset();
    settings.setInactivityCycleRanAt.mockReset().mockResolvedValue(undefined);
    messages.send.mockReset().mockResolvedValue({ id: "555" });
    service = new InactivityCleanupService();
  });

  afterEach(() => {
    service.shutdown();
    vi.useRealTimers();
  });

  it("warns on startup when no full cycle has ever run", async () => {
    settings.getInactivityCycleRanAt.mockResolvedValue(null);

    service.initialize();
    await vi.advanceTimersByTimeAsync(0);

    expect(warning.createMany).toHaveBeenCalledTimes(1);
    expect(settings.setInactivityCycleRanAt).toHaveBeenCalledWith(NOW);
  });

  it("warns on startup when the last full cycle is more than a week old", async () => {
    settings.getInactivityCycleRanAt.mockResolvedValue(
      new Date(NOW.getTime() - 8 * DAY_MS),
    );

    service.initialize();
    await vi.advanceTimersByTimeAsync(0);

    expect(warning.createMany).toHaveBeenCalledTimes(1);
  });

  it("only resolves and removes on startup when the last full cycle is recent", async () => {
    settings.getInactivityCycleRanAt.mockResolvedValue(
      new Date(NOW.getTime() - 2 * DAY_MS),
    );

    service.initialize();
    await vi.advanceTimersByTimeAsync(0);

    expect(warning.getExpiredWarnings).toHaveBeenCalledTimes(1);
    expect(warning.createMany).not.toHaveBeenCalled();
    expect(settings.setInactivityCycleRanAt).not.toHaveBeenCalled();
  });

  it("runs the full cycle on the first hourly tick after the week is up", async () => {
    const ranAt = new Date(NOW.getTime() - 7 * DAY_MS + 30 * 60 * 1000);
    settings.getInactivityCycleRanAt.mockResolvedValue(ranAt);

    service.initialize();
    await vi.advanceTimersByTimeAsync(0);
    expect(warning.createMany).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(HOUR_MS);

    expect(warning.createMany).toHaveBeenCalledTimes(1);
    expect(settings.setInactivityCycleRanAt).toHaveBeenCalledTimes(1);
  });

  it("does not record the cycle when it fails", async () => {
    settings.getInactivityCycleRanAt.mockResolvedValue(null);
    warning.getInactivePlayers.mockRejectedValue(new Error("db down"));

    service.initialize();
    await vi.advanceTimersByTimeAsync(0);

    expect(settings.setInactivityCycleRanAt).not.toHaveBeenCalled();
  });

  it("records a forced run so the next automatic cycle waits a full week", async () => {
    await service.forceRunAndResetSchedule({
      discordId: "1",
      username: "admin",
    });

    expect(warning.createMany).toHaveBeenCalledTimes(1);
    expect(settings.setInactivityCycleRanAt).toHaveBeenCalledWith(NOW);
  });

  it("refuses a forced run while another run is in progress", async () => {
    let finishWarnings!: () => void;
    warning.createMany.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishWarnings = resolve;
      }),
    );
    const admin = { discordId: "1", username: "admin" };

    const first = service.forceRunAndResetSchedule(admin);
    await vi.advanceTimersByTimeAsync(0);

    await expect(service.forceRunAndResetSchedule(admin)).rejects.toThrow(
      "already in progress",
    );

    finishWarnings();
    await first;
    expect(warning.createMany).toHaveBeenCalledTimes(1);
    await expect(
      service.forceRunAndResetSchedule(admin),
    ).resolves.toBeUndefined();
  });
});
