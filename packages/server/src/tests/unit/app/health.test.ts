import { describe, it, expect, vi } from "vitest";

vi.mock("@/db", () => ({ default: { query: vi.fn() } }));

import { rollupStatus } from "@/app/health";
import { ServiceState } from "@/services";

type Components = Parameters<typeof rollupStatus>[0];

function components(overrides: Partial<Components> = {}): Components {
  return {
    database: { status: "up" },
    mainBot: { status: "up" },
    websocket: { status: "up" },
    playtime: { status: "up" },
    ...overrides,
  };
}

describe("rollupStatus", () => {
  it("is healthy when every component is up and every service is ready", () => {
    expect(
      rollupStatus(components(), {
        a: ServiceState.READY,
        b: ServiceState.READY,
      }),
    ).toBe("healthy");
  });

  it("stays healthy when a registered service has not been resolved yet", () => {
    expect(
      rollupStatus(components(), {
        a: ServiceState.READY,
        b: ServiceState.UNINITIALIZED,
      }),
    ).toBe("healthy");
  });

  it("degrades while a service is still initializing", () => {
    expect(
      rollupStatus(components(), {
        a: ServiceState.READY,
        b: ServiceState.INITIALIZING,
      }),
    ).toBe("degraded");
  });

  it("degrades when a non-critical component is down", () => {
    expect(
      rollupStatus(components({ websocket: { status: "down" } }), {
        a: ServiceState.READY,
      }),
    ).toBe("degraded");
  });

  it("degrades when a component reports degraded", () => {
    expect(
      rollupStatus(components({ playtime: { status: "degraded" } }), {
        a: ServiceState.READY,
      }),
    ).toBe("degraded");
  });

  it("is down when a critical component is down", () => {
    expect(
      rollupStatus(components({ database: { status: "down" } }), {
        a: ServiceState.READY,
      }),
    ).toBe("down");
  });

  it("is down when a service failed to initialize", () => {
    expect(
      rollupStatus(components(), {
        a: ServiceState.READY,
        b: ServiceState.FAILED,
      }),
    ).toBe("down");
  });
});
