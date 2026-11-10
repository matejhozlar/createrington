import { describe, it, expect, vi, beforeEach } from "vitest";

const { setEnabled, logAction } = vi.hoisted(() => ({
  setEnabled: vi.fn(),
  logAction: vi.fn(),
}));

vi.mock("@/db", () => ({
  Q: { admin: { log: { action: { logAction } } } },
}));
vi.mock("@/services/feature-flag", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/feature-flag")>()),
  featureFlagService: { setEnabled, list: vi.fn() },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn().mockResolvedValue(true) },
}));

import { TRPCError } from "@trpc/server";
import { AuthRole } from "@createrington/shared/auth";
import { adminFeaturesRouter } from "@/trpc/routers/admin/features";
import type { Context } from "@/trpc/context";

const caller = adminFeaturesRouter.createCaller({
  user: {
    discordId: "100000000000000009",
    username: "admin",
    minecraftUsername: "Admin",
    minecraftUuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    role: AuthRole.ADMIN,
    isAdmin: true,
  },
  service: null,
  ip: "127.0.0.1",
} satisfies Context);

async function rejection(call: Promise<unknown>): Promise<TRPCError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected the call to be rejected");
}

beforeEach(() => {
  vi.clearAllMocks();
  setEnabled.mockResolvedValue({ name: "gallery", enabled: true });
});

describe("admin.features.set", () => {
  it("switches a flag and audits who did it", async () => {
    await caller.set({ name: "gallery", enabled: true });

    expect(setEnabled).toHaveBeenCalledWith("gallery", true, undefined);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminDiscordId: "100000000000000009",
        actionType: "feature_flag_set",
        metadata: { name: "gallery", enabled: true },
      }),
    );
  });

  it("refuses an owner-only flag to an admin", async () => {
    const error = await rejection(
      caller.set({ name: "launcher_curseforge_cdn", enabled: true }),
    );

    expect(error).toMatchObject({
      code: "FORBIDDEN",
      message: "Only the owner can change this feature",
    });
    expect(setEnabled).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });

  it("rejects a flag name that does not exist", async () => {
    const error = await rejection(
      caller.set({ name: "free_money" as "gallery", enabled: true }),
    );

    expect(error.code).toBe("BAD_REQUEST");
    expect(setEnabled).not.toHaveBeenCalled();
  });
});
