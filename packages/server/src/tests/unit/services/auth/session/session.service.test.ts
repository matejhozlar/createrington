import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

type SessionRow = {
  id: number;
  discordId: string;
  discordUsername: string | null;
  discordAvatar: string | null;
  tokenHash: string;
  familyId: string;
  ipAddress: string | null;
  userAgent: string | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

let rows: SessionRow[];
let nextId: number;
let failNextFind: boolean;
let claimedElsewhere: boolean;

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

vi.mock("@/db", () => {
  const auth = {
    session: {
      find: async ({ tokenHash }: { tokenHash: string }) => {
        if (failNextFind) {
          failNextFind = false;
          throw new Error("db down");
        }
        const row = rows.find((r) => r.tokenHash === tokenHash);
        return row ? { ...row } : null;
      },
      revokeById: async (id: number) => {
        const row = rows.find((r) => r.id === id);
        if (row && claimedElsewhere) {
          claimedElsewhere = false;
          row.revokedAt = new Date();
        }
        if (!row || row.revokedAt) return false;
        row.revokedAt = new Date();
        return true;
      },
      updateAll: async (
        updates: { revokedAt: Date },
        filters: Partial<
          Record<"familyId" | "tokenHash" | "discordId", string>
        >,
      ) => {
        let count = 0;
        for (const row of rows) {
          if (row.revokedAt) continue;
          if (filters.familyId && row.familyId !== filters.familyId) continue;
          if (filters.tokenHash && row.tokenHash !== filters.tokenHash)
            continue;
          if (filters.discordId && row.discordId !== filters.discordId)
            continue;
          row.revokedAt = updates.revokedAt;
          count++;
        }
        return count;
      },
      create: async (data: {
        discordId: string;
        discordUsername: string | null;
        discordAvatar: string | null;
        tokenHash: string;
        familyId?: string;
        ipAddress: string | null;
        userAgent: string | null;
        expiresAt: Date;
      }) => {
        rows.push({
          id: nextId++,
          discordId: data.discordId,
          discordUsername: data.discordUsername,
          discordAvatar: data.discordAvatar,
          tokenHash: data.tokenHash,
          familyId: data.familyId ?? `family-${nextId}`,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          revokedAt: null,
          expiresAt: data.expiresAt,
        });
      },
      deleteAll: async () => 0,
    },
  };
  return {
    Q: { auth },
    db: {
      inTransaction: async <T>(fn: (tx: { auth: typeof auth }) => Promise<T>) =>
        fn({ auth }),
    },
  };
});

import { sessionService } from "@/services/auth/session/session.service";

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// The service singleton's grace cache persists across tests, so every token
// is namespaced per test run to guarantee isolation.
let testRun = 0;

function tok(name: string): string {
  return `${name}-${testRun}`;
}

function seedSession(
  token: string,
  overrides: Partial<SessionRow> = {},
): SessionRow {
  const row: SessionRow = {
    id: nextId++,
    discordId: "user-1",
    discordUsername: "tester",
    discordAvatar: null,
    tokenHash: hash(token),
    familyId: "family-1",
    ipAddress: null,
    userAgent: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
    ...overrides,
  };
  rows.push(row);
  return row;
}

beforeEach(() => {
  rows = [];
  nextId = 1;
  failNextFind = false;
  claimedElsewhere = false;
  testRun++;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SessionService.rotateToken", () => {
  it("rotates a valid token: revokes the old session and issues a successor in the same family", async () => {
    const seeded = seedSession(tok("valid"));

    const result = await sessionService.rotateToken(tok("valid"));

    expect(result).not.toBeNull();
    expect(result!.rawToken).not.toBe(tok("valid"));
    expect(result!.discordId).toBe("user-1");
    expect(seeded.revokedAt).not.toBeNull();

    const successor = rows.find((r) => r.tokenHash === hash(result!.rawToken));
    expect(successor).toBeDefined();
    expect(successor!.familyId).toBe("family-1");
    expect(successor!.revokedAt).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const result = await sessionService.rotateToken(tok("unknown"));
    expect(result).toBeNull();
  });

  it("returns null and revokes an expired token", async () => {
    const seeded = seedSession(tok("expired"), {
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await sessionService.rotateToken(tok("expired"));

    expect(result).toBeNull();
    expect(seeded.revokedAt).not.toBeNull();
  });

  it("revokes the whole family when a revoked token is replayed", async () => {
    seedSession(tok("stolen"), {
      revokedAt: new Date(),
      familyId: "family-theft",
    });
    const sibling = seedSession(tok("sibling"), {
      familyId: "family-theft",
    });

    const result = await sessionService.rotateToken(tok("stolen"));

    expect(result).toBeNull();
    expect(sibling.revokedAt).not.toBeNull();
  });

  it("returns the same successor to concurrent rotations of the same token", async () => {
    seedSession(tok("race"), { familyId: "family-race" });

    const [a, b] = await Promise.all([
      sessionService.rotateToken(tok("race")),
      sessionService.rotateToken(tok("race")),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.rawToken).toBe(b!.rawToken);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);
  });

  it("issues no successor and revokes the family when another process claims the token first", async () => {
    seedSession(tok("claimed"), { familyId: "family-claimed" });
    const sibling = seedSession(tok("claimed-sibling"), {
      familyId: "family-claimed",
    });
    claimedElsewhere = true;

    const result = await sessionService.rotateToken(tok("claimed"));

    expect(result).toBeNull();
    expect(rows).toHaveLength(2);
    expect(sibling.revokedAt).not.toBeNull();
  });

  it("returns the same successor to a replay within the grace window without revoking the family", async () => {
    seedSession(tok("grace"), { familyId: "family-grace" });

    const first = await sessionService.rotateToken(tok("grace"));
    const replay = await sessionService.rotateToken(tok("grace"));

    expect(first).not.toBeNull();
    expect(replay).not.toBeNull();
    expect(replay!.rawToken).toBe(first!.rawToken);
    expect(rows).toHaveLength(2);

    const successor = rows.find((r) => r.tokenHash === hash(first!.rawToken));
    expect(successor!.revokedAt).toBeNull();
  });

  it("returns null on a grace replay after a logout without treating it as theft", async () => {
    seedSession(tok("logout"), { familyId: "family-logout" });
    const sibling = seedSession(tok("logout-sibling"), {
      familyId: "family-logout",
    });

    const first = await sessionService.rotateToken(tok("logout"));
    expect(first).not.toBeNull();

    await sessionService.revokeByToken(first!.rawToken);
    const warn = vi.spyOn(logger, "warn");

    const replay = await sessionService.rotateToken(tok("logout"));

    expect(replay).toBeNull();
    expect(sibling.revokedAt).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("follows the rotation chain when the successor was itself already rotated", async () => {
    seedSession(tok("chain"), { familyId: "family-chain" });

    const first = await sessionService.rotateToken(tok("chain"));
    const second = await sessionService.rotateToken(first!.rawToken);
    const replay = await sessionService.rotateToken(tok("chain"));

    expect(second).not.toBeNull();
    expect(replay).not.toBeNull();
    expect(replay!.rawToken).toBe(second!.rawToken);
  });

  it("evicts the cache entry when rotation throws so a retry can succeed", async () => {
    seedSession(tok("flaky"), { familyId: "family-flaky" });

    failNextFind = true;
    await expect(sessionService.rotateToken(tok("flaky"))).rejects.toThrow(
      "db down",
    );

    const retry = await sessionService.rotateToken(tok("flaky"));
    expect(retry).not.toBeNull();
  });

  it("treats a replay after the grace window as theft", async () => {
    vi.useFakeTimers();
    seedSession(tok("late"), { familyId: "family-late" });

    const first = await sessionService.rotateToken(tok("late"));
    expect(first).not.toBeNull();

    vi.advanceTimersByTime(61_000);

    const replay = await sessionService.rotateToken(tok("late"));

    expect(replay).toBeNull();
    const successor = rows.find((r) => r.tokenHash === hash(first!.rawToken));
    expect(successor!.revokedAt).not.toBeNull();
  });
});
