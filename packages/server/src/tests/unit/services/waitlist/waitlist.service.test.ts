import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/db/utils/errors", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.errors(),
);
vi.mock("@/db", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.db(),
);
vi.mock("@/config", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.config(),
);
vi.mock("@/discord/bots/main/client", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.client(),
);
vi.mock("@/discord/constants", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.constants(),
);
vi.mock("@/discord/embeds", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.embeds(),
);
vi.mock("@/discord/components/presets/registration", async () =>
  (
    await import("@/tests/helpers/waitlist")
  ).waitlistMocks.registrationPresets(),
);
vi.mock("@/discord/components/presets/waitlist", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.waitlistPresets(),
);
vi.mock("@/discord/bots/main/registration/verification-channel", async () =>
  (
    await import("@/tests/helpers/waitlist")
  ).waitlistMocks.verificationChannel(),
);
vi.mock("@/app/middleware/error-handler", async () =>
  (await import("@/tests/helpers/waitlist")).waitlistMocks.errorHandler(),
);

import { WaitlistService } from "@/services/waitlist/waitlist.service";
import { WaitlistPromotionService } from "@/services/waitlist/promotion.service";
import {
  fakeEntry,
  resetWaitlistState,
  waitlistState as state,
} from "@/tests/helpers/waitlist";

beforeEach(resetWaitlistState);

describe("WaitlistService.reserveForDirectRegistration", () => {
  it("returns null without writing when no slot is free", async () => {
    state.free = 0;
    const svc = new WaitlistService();
    expect(
      await svc.reserveForDirectRegistration("u1", "user1", null),
    ).toBeNull();
    expect(state.entries).toHaveLength(0);
  });

  it("creates a promoted entry with its verification channel and notifies admins", async () => {
    state.free = 1;
    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration(
      "u1",
      "user1",
      "verify-7",
    );

    expect(result?.reserved).toBe(true);
    expect(result?.entry.status).toBe("promoted");
    expect(result?.entry.verifyChannelId).toBe("verify-7");
    expect(state.free).toBe(0);
    expect(state.adminSend).toHaveBeenCalledTimes(1);
  });

  it("re-applies the status guards when the insert loses a duplicate-key race", async () => {
    state.free = 1;
    state.entries.push(fakeEntry({ discordId: "u1", status: "queued" }));
    state.hideNextFind = true;

    const svc = new WaitlistService();
    await expect(
      svc.reserveForDirectRegistration("u1", "user1", null),
    ).rejects.toThrow("Queued members are promoted in order");
    expect(state.entries[0].status).toBe("queued");
  });

  it("reports reserved=false for a member who already holds a promotion", async () => {
    state.free = 0;
    const entry = fakeEntry({ discordId: "u1", status: "promoted" });
    state.entries.push(entry);

    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration("u1", "user1", null);
    expect(result).toEqual({ entry, reserved: false });
  });

  it("flips an expired entry back to promoted instead of creating a duplicate", async () => {
    state.free = 1;
    const entry = fakeEntry({
      discordId: "u1",
      status: "expired",
      expiredAt: new Date(),
    });
    state.entries.push(entry);

    const svc = new WaitlistService();
    const result = await svc.reserveForDirectRegistration(
      "u1",
      "user1",
      "verify-9",
    );

    expect(result?.reserved).toBe(true);
    expect(state.entries).toHaveLength(1);
    expect(entry.status).toBe("promoted");
    expect(entry.expiredAt).toBeNull();
    expect(entry.verifyChannelId).toBe("verify-9");
    expect(state.progressEmbed).toHaveBeenCalledWith(entry.id);
  });

  it("lets only one of two simultaneous registrations take the last slot", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    const svc = new WaitlistService();

    const [a, b] = await Promise.all([
      svc.reserveForDirectRegistration("u1", "user1", null),
      svc.reserveForDirectRegistration("u2", "user2", null),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(state.entries).toHaveLength(1);
    expect(state.free).toBe(0);
  });

  it("serializes against the promotion pass so the pass and a direct registration cannot share a slot", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    const queued = fakeEntry({ discordId: "queued-1" });
    state.entries.push(queued);

    const svc = new WaitlistService();
    const promotion = new WaitlistPromotionService();
    const [promoted, reservation] = await Promise.all([
      promotion.promoteEligible(),
      svc.reserveForDirectRegistration("direct-1", "direct", null),
    ]);

    const promotedCount = state.entries.filter(
      (e) => e.status === "promoted",
    ).length;
    expect(promotedCount).toBe(1);
    expect(promoted + (reservation ? 1 : 0)).toBe(1);
    expect(state.free).toBe(0);
  });
});
