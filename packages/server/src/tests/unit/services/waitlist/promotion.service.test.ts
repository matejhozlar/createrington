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

import { WaitlistPromotionService } from "@/services/waitlist/promotion.service";
import {
  fakeEntry,
  resetWaitlistState,
  unknownMember,
  waitlistState as state,
} from "@/tests/helpers/waitlist";

beforeEach(resetWaitlistState);

describe("WaitlistPromotionService.promoteEligible", () => {
  it("promotes the oldest queued entries and stops when the slots run out", async () => {
    state.free = 2;
    const first = fakeEntry({ queuedAt: new Date(1_000) });
    const second = fakeEntry({ queuedAt: new Date(2_000) });
    const third = fakeEntry({ queuedAt: new Date(3_000) });
    state.entries.push(third, first, second);

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(2);

    expect(first.status).toBe("promoted");
    expect(second.status).toBe("promoted");
    expect(third.status).toBe("queued");
  });

  it("coalesces concurrent calls into one pass plus a single follow-up", async () => {
    state.free = 1;
    state.freeDelayMs = 10;
    state.entries.push(fakeEntry({}));

    const svc = new WaitlistPromotionService();
    const a = svc.promoteEligible();
    const b = svc.promoteEligible();
    const c = svc.promoteEligible();

    expect(await Promise.all([a, b, c])).toEqual([1, 1, 1]);
    expect(state.findAllCalls).toBe(1);

    state.free = 0;
    await svc.promoteEligible();
    expect(state.findAllCalls).toBe(1);
  });

  it("does nothing while the guild is not in the bot cache", async () => {
    state.free = 5;
    state.guildAvailable = false;
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("queued");
    expect(state.memberFetch).not.toHaveBeenCalled();
  });

  it("skips, rather than expires, entries whose member lookup fails transiently", async () => {
    state.free = 5;
    state.memberFetch.mockRejectedValue(new Error("503 Service Unavailable"));
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("queued");
  });

  it("expires entries only when Discord reports the member gone", async () => {
    state.free = 5;
    state.memberFetch.mockRejectedValue(unknownMember());
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(0);
    expect(entry.status).toBe("expired");
    expect(entry.expiredAt).toBeInstanceOf(Date);
  });

  it("runs a follow-up pass when a full batch still leaves free slots", async () => {
    state.free = 150;
    for (let i = 0; i < 120; i++) {
      state.entries.push(fakeEntry({ queuedAt: new Date(i * 1_000) }));
    }

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(120);
    expect(state.findAllCalls).toBe(2);
    expect(state.entries.every((e) => e.status === "promoted")).toBe(true);
  });

  it("alerts admins when a promoted member could not be pinged", async () => {
    state.free = 1;
    state.channelFetch.mockRejectedValue(new Error("502 Bad Gateway"));
    const entry = fakeEntry({});
    state.entries.push(entry);

    const svc = new WaitlistPromotionService();
    expect(await svc.promoteEligible()).toBe(1);
    expect(entry.status).toBe("promoted");
    expect(state.adminSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "notifications",
        content: expect.stringContaining(`#${entry.id}`),
      }),
    );
  });
});
