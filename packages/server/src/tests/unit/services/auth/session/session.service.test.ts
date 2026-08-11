import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

type SessionRow = {
  id: number;
  discord_id: string;
  discord_username: string | null;
  discord_avatar: string | null;
  token_hash: string;
  family_id: string;
  ip_address: string | null;
  user_agent: string | null;
  revoked_at: Date | null;
  expires_at: Date;
};

let rows: SessionRow[];
let nextId: number;

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDevDeployment: false },
    app: {
      auth: {
        refreshToken: { expiresInDays: 30 },
        cookie: {
          name: "crt_refresh",
          accessName: "crt_access",
          domain: undefined,
        },
      },
    },
  },
}));

vi.mock("@/db", () => ({
  auth: {
    session: {
      findByTokenHash: async (tokenHash: string) =>
        rows.find((r) => r.token_hash === tokenHash) ?? null,
      revokeById: async (id: number) => {
        const row = rows.find((r) => r.id === id);
        if (row && !row.revoked_at) row.revoked_at = new Date();
      },
      revokeByFamily: async (familyId: string) => {
        for (const row of rows) {
          if (row.family_id === familyId && !row.revoked_at) {
            row.revoked_at = new Date();
          }
        }
      },
      revokeByTokenHash: async (tokenHash: string) => {
        const row = rows.find((r) => r.token_hash === tokenHash);
        if (row && !row.revoked_at) row.revoked_at = new Date();
      },
      revokeAllForUser: async () => {},
      insertSession: async (data: {
        discordId: string;
        discordUsername: string | null;
        discordAvatar: string | null;
        tokenHash: string;
        familyId: string | null;
        ipAddress: string | null;
        userAgent: string | null;
        expiresAt: Date;
      }) => {
        const row: SessionRow = {
          id: nextId++,
          discord_id: data.discordId,
          discord_username: data.discordUsername,
          discord_avatar: data.discordAvatar,
          token_hash: data.tokenHash,
          family_id: data.familyId ?? `family-${nextId}`,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          revoked_at: null,
          expires_at: data.expiresAt,
        };
        rows.push(row);
        return row;
      },
      deleteExpired: async () => 0,
    },
  },
}));

import { sessionService } from "@/services/auth/session/session.service";

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function seedSession(
  token: string,
  overrides: Partial<SessionRow> = {},
): SessionRow {
  const row: SessionRow = {
    id: nextId++,
    discord_id: "user-1",
    discord_username: "tester",
    discord_avatar: null,
    token_hash: hash(token),
    family_id: "family-1",
    ip_address: null,
    user_agent: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
  };
  rows.push(row);
  return row;
}

beforeEach(() => {
  rows = [];
  nextId = 1;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionService.rotateToken", () => {
  it("rotates a valid token: revokes the old session and issues a successor in the same family", async () => {
    const seeded = seedSession("valid-token-1");

    const result = await sessionService.rotateToken("valid-token-1");

    expect(result).not.toBeNull();
    expect(result!.rawToken).not.toBe("valid-token-1");
    expect(result!.discordId).toBe("user-1");
    expect(seeded.revoked_at).not.toBeNull();

    const successor = rows.find((r) => r.token_hash === hash(result!.rawToken));
    expect(successor).toBeDefined();
    expect(successor!.family_id).toBe("family-1");
    expect(successor!.revoked_at).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const result = await sessionService.rotateToken("unknown-token-1");
    expect(result).toBeNull();
  });

  it("returns null and revokes an expired token", async () => {
    const seeded = seedSession("expired-token-1", {
      expires_at: new Date(Date.now() - 1000),
    });

    const result = await sessionService.rotateToken("expired-token-1");

    expect(result).toBeNull();
    expect(seeded.revoked_at).not.toBeNull();
  });

  it("revokes the whole family when a revoked token is replayed", async () => {
    seedSession("stolen-token-1", {
      revoked_at: new Date(),
      family_id: "family-theft",
    });
    const sibling = seedSession("sibling-token-1", {
      family_id: "family-theft",
    });

    const result = await sessionService.rotateToken("stolen-token-1");

    expect(result).toBeNull();
    expect(sibling.revoked_at).not.toBeNull();
  });

  it("returns the same successor to concurrent rotations of the same token", async () => {
    seedSession("race-token-1", { family_id: "family-race" });

    const [a, b] = await Promise.all([
      sessionService.rotateToken("race-token-1"),
      sessionService.rotateToken("race-token-1"),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.rawToken).toBe(b!.rawToken);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.revoked_at === null)).toHaveLength(1);
  });

  it("returns the same successor to a replay within the grace window without revoking the family", async () => {
    seedSession("grace-token-1", { family_id: "family-grace" });

    const first = await sessionService.rotateToken("grace-token-1");
    const replay = await sessionService.rotateToken("grace-token-1");

    expect(first).not.toBeNull();
    expect(replay).not.toBeNull();
    expect(replay!.rawToken).toBe(first!.rawToken);
    expect(rows).toHaveLength(2);

    const successor = rows.find((r) => r.token_hash === hash(first!.rawToken));
    expect(successor!.revoked_at).toBeNull();
  });

  it("treats a replay after the grace window as theft", async () => {
    vi.useFakeTimers();
    seedSession("late-token-1", { family_id: "family-late" });

    const first = await sessionService.rotateToken("late-token-1");
    expect(first).not.toBeNull();

    vi.advanceTimersByTime(61_000);

    const replay = await sessionService.rotateToken("late-token-1");

    expect(replay).toBeNull();
    const successor = rows.find((r) => r.token_hash === hash(first!.rawToken));
    expect(successor!.revoked_at).not.toBeNull();
  });
});
