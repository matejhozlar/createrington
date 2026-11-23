import { describe, it, expect, vi, beforeEach } from "vitest";

const { launcher } = vi.hoisted(() => ({ launcher: { available: true } }));

vi.mock("@/config", () => ({
  default: {
    envMode: { isDev: false },
    launcher,
    app: { auth: { owner: { discordId: "1" } } },
  },
}));
vi.mock("@/http-logger", () => ({
  httpLogger: { info: vi.fn() },
  colorDuration: (ms: number) => `${ms}ms`,
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn() },
}));

import { launcherAvailable, publicProcedure, router } from "@/trpc/trpc";
import { testContext } from "@/tests/helpers/trpc";

const caller = router({
  ping: publicProcedure.use(launcherAvailable).query(() => "pong"),
}).createCaller(testContext());

describe("launcherAvailable", () => {
  beforeEach(() => {
    launcher.available = true;
  });

  it("lets the call through where the launcher is available", async () => {
    await expect(caller.ping()).resolves.toBe("pong");
  });

  it("answers NOT_FOUND on the production deployment", async () => {
    launcher.available = false;

    await expect(caller.ping()).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
