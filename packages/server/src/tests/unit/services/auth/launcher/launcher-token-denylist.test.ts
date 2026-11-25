import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const redis = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    enabled: true,
    isReady: true,
    sendCommand: async (args: string[]): Promise<unknown> => {
      const [command, key, value] = args;
      if (command === "GET") return values.get(key) ?? null;
      if (command === "SET") {
        values.set(key, value);
        return "OK";
      }
      throw new Error(`unexpected redis command ${command}`);
    },
  };
});

vi.mock("@/services/redis", () => ({ redisService: redis }));
vi.mock("@/services/auth/launcher/launcher-jwt.service", () => ({
  LAUNCHER_ACCESS_TOKEN_TTL_SECONDS: 900,
}));

import {
  denyLauncherFamily,
  denyLauncherPlayer,
  isLauncherTokenDenied,
} from "@/services/auth/launcher/launcher-token-denylist";
import type { LauncherJwtPayload } from "@/services/auth/launcher/launcher-jwt.service";

const T0 = new Date("2026-11-25T10:00:00Z");

function token(familyId: string, minecraftUuid: string): LauncherJwtPayload {
  return {
    familyId,
    minecraftUuid,
    issuedAt: T0.getTime() / 1000,
  } as LauncherJwtPayload;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(T0.getTime() + 60_000));
  redis.values.clear();
  redis.isReady = true;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("launcher token denylist", () => {
  it("keeps refusing a token denied while Redis was unreachable once Redis is back", async () => {
    redis.isReady = false;
    await denyLauncherFamily("family-paused");

    redis.isReady = true;

    expect(await isLauncherTokenDenied(token("family-paused", "uuid-1"))).toBe(
      true,
    );
  });

  it("keeps refusing a token denied while Redis was up when Redis becomes unreachable", async () => {
    await denyLauncherPlayer("uuid-2");

    redis.isReady = false;

    expect(await isLauncherTokenDenied(token("family-2", "uuid-2"))).toBe(true);
  });

  it("lets a token through that was issued after the denial", async () => {
    await denyLauncherFamily("family-3");

    const issuedLater = {
      ...token("family-3", "uuid-3"),
      issuedAt: (T0.getTime() + 120_000) / 1000,
    };

    expect(await isLauncherTokenDenied(issuedLater)).toBe(false);
  });

  it("lets a token through that was never denied", async () => {
    expect(await isLauncherTokenDenied(token("family-4", "uuid-4"))).toBe(
      false,
    );
  });
});
