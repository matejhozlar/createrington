import { describe, it, expect, vi, beforeEach } from "vitest";

const { getOptionalService, logAction, cleanup } = vi.hoisted(() => ({
  getOptionalService: vi.fn(),
  logAction: vi.fn(),
  cleanup: {
    forceRunAndResetSchedule: vi.fn(),
    triggerResolveAndRemove: vi.fn(),
  },
}));

vi.mock("@/db", () => ({
  Q: { admin: { log: { action: { logAction } } } },
}));
vi.mock("@/services", () => ({
  getService: vi.fn(),
  getOptionalService,
  Services: { INACTIVITY_CLEANUP_SERVICE: "discord.inactivityCleanupService" },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));
vi.mock("@/services/discord/cleanup/inactivity/remove-warning", () => ({
  removeInactiveWarning: vi.fn(),
}));
vi.mock("@/discord/constants", () => ({ Discord: {} }));
vi.mock("@/discord/embeds", () => ({ EmbedPresets: {} }));

import { inactivityRouter } from "@/trpc/routers/admin/inactivity";
import { adminContext } from "@/tests/helpers/trpc";

const caller = inactivityRouter.createCaller(
  adminContext({ minecraftUsername: "admin" }),
);

const MUTATIONS = [
  {
    name: "triggerCleanup",
    run: () => caller.triggerCleanup(),
    method: cleanup.forceRunAndResetSchedule,
  },
  {
    name: "triggerResolveRemove",
    run: () => caller.triggerResolveRemove(),
    method: cleanup.triggerResolveAndRemove,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(MUTATIONS)("admin.inactivity.$name", ({ run, method }) => {
  it("is forbidden where the cleanup service is not configured", async () => {
    getOptionalService.mockResolvedValue(null);

    await expect(run()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(method).not.toHaveBeenCalled();
  });

  it("reports the service as unavailable when it failed to start, without its error", async () => {
    getOptionalService.mockRejectedValue(
      new Error("An invalid token was provided."),
    );

    await expect(run()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Inactivity cleanup service is not available",
    });
    expect(method).not.toHaveBeenCalled();
  });

  it("runs the cleanup and audits it when the service is ready", async () => {
    getOptionalService.mockResolvedValue(cleanup);

    await run();

    expect(method).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledTimes(1);
  });
});
