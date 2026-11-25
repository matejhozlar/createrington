import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ServerMaintenanceSchedule } from "@createrington/shared/db/server_maintenance_schedule.types";

vi.mock("@/db", () => ({
  Q: {
    server: {
      maintenance: {
        schedule: {
          createAndReturn: async (data: Partial<ServerMaintenanceSchedule>) =>
            ({
              id: 1,
              untilRestart: false,
              ...data,
            }) as ServerMaintenanceSchedule,
          updateAndReturn: async (
            _where: unknown,
            data: Partial<ServerMaintenanceSchedule>,
          ) => ({ id: 1, serverId: 1, ...data }) as ServerMaintenanceSchedule,
          update: async () => {},
          findAll: async () => [],
        },
      },
    },
  },
}));

vi.mock("@/discord/constants", () => ({
  Discord: { Channels: { railsNSails: { MINECRAFT_CHAT: "chat-1" } } },
}));

import { MaintenanceScheduler } from "@/services/maintenance/scheduler";
import type { MaintenanceService } from "@/services/maintenance/maintenance.service";
import type { DiscordMessageService } from "@/services/discord/message/message.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

describe("MaintenanceScheduler", () => {
  let send: ReturnType<typeof vi.fn>;
  let apply: ReturnType<typeof vi.fn>;
  let scheduler: MaintenanceScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-24T12:00:00Z"));
    send = vi.fn().mockResolvedValue(undefined);
    apply = vi.fn().mockResolvedValue({ applied: true });
    scheduler = new MaintenanceScheduler(
      { apply } as unknown as MaintenanceService,
      { send } as unknown as DiscordMessageService,
    );
  });

  afterEach(() => {
    scheduler.shutdown();
    vi.useRealTimers();
  });

  it("holds the warnings and the start of a window 40 days out until their time", async () => {
    const scheduledAt = new Date(Date.now() + 40 * DAY_MS);
    await scheduler.schedule({
      serverId: 1,
      scheduledAt,
      estimatedMinutes: 30,
      scheduledByDiscordId: "admin-1",
    });

    await vi.advanceTimersByTimeAsync(MINUTE_MS);
    expect(send).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(40 * DAY_MS - 61 * MINUTE_MS - 1);
    expect(send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0].content).toContain("in 1 hour");
    expect(apply).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60 * MINUTE_MS);
    expect(send).toHaveBeenCalledTimes(6);
    expect(apply).toHaveBeenCalledOnce();
  });

  it("arms nothing more once a window 40 days out is cancelled", async () => {
    await scheduler.schedule({
      serverId: 1,
      scheduledAt: new Date(Date.now() + 40 * DAY_MS),
      estimatedMinutes: 30,
      scheduledByDiscordId: "admin-1",
    });

    await vi.advanceTimersByTimeAsync(30 * DAY_MS);
    await scheduler.cancel(1);
    await vi.advanceTimersByTimeAsync(20 * DAY_MS);

    expect(send).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});
