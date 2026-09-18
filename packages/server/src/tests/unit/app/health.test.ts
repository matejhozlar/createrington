import { describe, it, expect, vi } from "vitest";

vi.mock("@/services", () => ({
  container: { getAllStates: vi.fn(() => ({})) },
  Services: {
    DISCORD_MAIN_BOT: "discord.mainBot",
    DISCORD_WEB_BOT: "discord.webBot",
  },
  getServiceSync: vi.fn(),
}));

vi.mock("@/db", () => ({ default: { query: vi.fn() } }));

import { rollupStatus } from "@/app/health";

type Components = Parameters<typeof rollupStatus>[0];

function components(overrides: Partial<Components> = {}): Components {
  return {
    database: { status: "up" },
    mainBot: { status: "up" },
    webBot: { status: "up" },
    websocket: { status: "up" },
    playtime: { status: "up" },
    ...overrides,
  };
}

describe("rollupStatus", () => {
  it("is healthy when every component is up and every service is ready", () => {
    expect(rollupStatus(components(), { a: "ready", b: "ready" })).toBe(
      "healthy",
    );
  });

  it("stays healthy when a registered service has not been resolved yet", () => {
    expect(rollupStatus(components(), { a: "ready", b: "uninitialized" })).toBe(
      "healthy",
    );
  });

  it("degrades while a service is still initializing", () => {
    expect(rollupStatus(components(), { a: "ready", b: "initializing" })).toBe(
      "degraded",
    );
  });

  it("degrades when a non-critical component is down", () => {
    expect(
      rollupStatus(components({ webBot: { status: "down" } }), { a: "ready" }),
    ).toBe("degraded");
  });

  it("degrades when a component reports degraded", () => {
    expect(
      rollupStatus(components({ playtime: { status: "degraded" } }), {
        a: "ready",
      }),
    ).toBe("degraded");
  });

  it("is down when a critical component is down", () => {
    expect(
      rollupStatus(components({ database: { status: "down" } }), {
        a: "ready",
      }),
    ).toBe("down");
  });

  it("is down when a service failed to initialize", () => {
    expect(rollupStatus(components(), { a: "ready", b: "failed" })).toBe(
      "down",
    );
  });
});
