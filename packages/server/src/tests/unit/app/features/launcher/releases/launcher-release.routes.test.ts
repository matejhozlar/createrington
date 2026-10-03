import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import crypto from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const { PUBLISH_TOKEN, mocks } = vi.hoisted(() => ({
  PUBLISH_TOKEN: "test-publish-token-please-do-not-use-in-prod",
  mocks: {
    publish: vi.fn(),
    checkForUpdate: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false },
    meta: { links: { website: "http://localhost:3000" } },
    app: {
      devClientOrigin: "http://localhost:3000",
      auth: {
        accessToken: { secret: "w".repeat(40), expiresIn: "15m" },
        modAccessToken: { secret: "m".repeat(40) },
        launcherAccessToken: { secret: "l".repeat(40) },
        sso: { corsOrigins: [] },
      },
    },
    launcher: {
      channel: "staging",
      publishTokenHash:
        "c0d4f5f0b7f4a3a4f0d8f4b7d1b1a3a4c0d4f5f0b7f4a3a4f0d8f4b7d1b1a3a4",
      downloadHosts: ["gitea.example.com"],
    },
  },
}));
vi.mock("@/db", () => ({ Q: { player: { find: vi.fn() } } }));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
}));
vi.mock("@/services/discord/oauth/oauth.service", () => ({
  AuthRole: { ADMIN: "admin", USER: "user", UNVERIFIED: "unverified" },
}));
vi.mock("@/services/auth/token/access-cookie.service", () => ({
  accessCookieService: {
    isEnabled: () => false,
    extractFromRequest: () => undefined,
  },
}));
vi.mock("@/services/auth/admin-status/admin-status.service", () => ({
  adminStatusService: { isAdmin: vi.fn(async () => false) },
}));
vi.mock("@/services/launcher/release/launcher-release.service", () => ({
  launcherReleaseService: {
    publish: mocks.publish,
    checkForUpdate: mocks.checkForUpdate,
  },
}));

import express from "express";
import config from "@/config";
import { errorHandler, notFoundHandler } from "@/app/middleware/error-handler";
import {
  launcherPublishRoutes,
  launcherUpdateCheckRoutes,
} from "@/app/features/launcher/releases/launcher-release.routes";

const VALID_BODY = {
  channel: "staging",
  version: "0.2.0",
  platform: "windows-x86_64",
  url: "https://gitea.example.com/packages/launcher/0.2.0/setup.exe",
  signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ==",
  notes: "Faster start",
  pubDate: "2026-09-29T18:00:00Z",
};

const STRUCTURED_NOTES = {
  summary: "Faster start",
  changes: [
    {
      type: "improved",
      title: "Start time",
      description: "The launcher opens in half the time.",
    },
  ],
};

const UPDATE = {
  version: "0.2.0",
  notes: "Faster start",
  pub_date: "2026-09-29T18:00:00.000Z",
  url: VALID_BODY.url,
  signature: VALID_BODY.signature,
};

let server: Server;
let baseUrl: string;

async function post(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await fetch(`${baseUrl}/api/launcher/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const auth = { Authorization: `Bearer ${PUBLISH_TOKEN}` };

beforeAll(async () => {
  (config.launcher as { publishTokenHash: string }).publishTokenHash = crypto
    .createHash("sha256")
    .update(PUBLISH_TOKEN)
    .digest("hex");

  const app = express();
  app.use(express.json());
  app.use("/api/launcher", launcherUpdateCheckRoutes);
  app.use("/api/launcher", launcherPublishRoutes);
  app.use(errorHandler);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.publish.mockResolvedValue({
    id: 1,
    version: "0.2.0",
    platform: "windows-x86_64",
    status: "pending",
  });
  mocks.checkForUpdate.mockResolvedValue(null);
});

describe("POST /api/launcher/releases", () => {
  it("stores a release for a direct call with a valid token", async () => {
    const res = await post(VALID_BODY, auth);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        id: 1,
        version: "0.2.0",
        platform: "windows-x86_64",
        status: "pending",
      },
    });
    expect(mocks.publish).toHaveBeenCalledWith({
      ...VALID_BODY,
      pubDate: new Date("2026-09-29T18:00:00Z"),
    });
  });

  it("passes structured notes on to the service", async () => {
    const res = await post(
      { ...VALID_BODY, structuredNotes: STRUCTURED_NOTES },
      auth,
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith({
      ...VALID_BODY,
      structuredNotes: STRUCTURED_NOTES,
      pubDate: new Date("2026-09-29T18:00:00Z"),
    });
  });

  it("accepts a change type it has never seen", async () => {
    const structuredNotes = {
      ...STRUCTURED_NOTES,
      changes: [{ ...STRUCTURED_NOTES.changes[0], type: "deprecated" }],
    };

    const res = await post({ ...VALID_BODY, structuredNotes }, auth);

    expect(res.status).toBe(201);
  });

  it("refuses a call without a token", async () => {
    const res = await post(VALID_BODY);

    expect(res.status).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("refuses a call with a wrong token", async () => {
    const res = await post(VALID_BODY, {
      Authorization: "Bearer not-the-publish-token",
    });

    expect(res.status).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("refuses the token hash itself as a token", async () => {
    const res = await post(VALID_BODY, {
      Authorization: `Bearer ${config.launcher.publishTokenHash}`,
    });

    expect(res.status).toBe(401);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each(["X-Forwarded-For", "X-Real-IP"])(
    "answers 404 to a call that arrived through a proxy (%s), even with a valid token",
    async (header) => {
      const res = await post(VALID_BODY, { ...auth, [header]: "203.0.113.7" });

      expect(res.status).toBe(404);
      expect(mocks.publish).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["an unknown channel", { channel: "nightly" }],
    ["an unknown platform", { platform: "linux-x86_64" }],
    ["a URL that is not one", { url: "setup.exe" }],
    ["an empty signature", { signature: "" }],
    ["an unreadable publish date", { pubDate: "yesterday" }],
    [
      "structured notes without a summary",
      { structuredNotes: { changes: STRUCTURED_NOTES.changes } },
    ],
    [
      "a change without a description",
      {
        structuredNotes: {
          summary: "Faster start",
          changes: [{ type: "improved", title: "Start time" }],
        },
      },
    ],
  ])("refuses a body with %s", async (_label, override) => {
    const res = await post({ ...VALID_BODY, ...override }, auth);

    expect(res.status).toBe(400);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});

describe("an environment without a publish token", () => {
  let bareServer: Server;
  let bareUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/launcher", launcherUpdateCheckRoutes);
    app.use(notFoundHandler);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      bareServer = app.listen(0, "127.0.0.1", () => resolve());
    });
    bareUrl = `http://127.0.0.1:${(bareServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => bareServer.close(() => resolve()));
  });

  it("still answers the update check", async () => {
    const res = await fetch(
      `${bareUrl}/api/launcher/updates/windows-x86_64/0.1.0`,
    );

    expect(res.status).toBe(204);
    expect(mocks.checkForUpdate).toHaveBeenCalledWith(
      "windows-x86_64",
      "0.1.0",
    );
  });

  it("has no publish route", async () => {
    const res = await fetch(`${bareUrl}/api/launcher/releases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.status).toBe(404);
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});

describe("GET /api/launcher/updates/:platform/:currentVersion", () => {
  it("answers 204 with no body when there is nothing newer", async () => {
    const res = await fetch(
      `${baseUrl}/api/launcher/updates/windows-x86_64/0.2.0`,
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(mocks.checkForUpdate).toHaveBeenCalledWith(
      "windows-x86_64",
      "0.2.0",
    );
  });

  it("answers 200 with exactly the fields the updater expects", async () => {
    mocks.checkForUpdate.mockResolvedValue(UPDATE);

    const res = await fetch(
      `${baseUrl}/api/launcher/updates/windows-x86_64/0.1.2`,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(UPDATE);
  });

  it("needs no token and works through a proxy", async () => {
    mocks.checkForUpdate.mockResolvedValue(UPDATE);

    const res = await fetch(
      `${baseUrl}/api/launcher/updates/windows-x86_64/0.1.2`,
      { headers: { "X-Forwarded-For": "203.0.113.7" } },
    );

    expect(res.status).toBe(200);
  });

  it("is rate limited to 60 requests per window", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) {
      const res = await fetch(
        `${baseUrl}/api/launcher/updates/windows-x86_64/0.1.2`,
      );
      statuses.push(res.status);
    }

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    expect(statuses.filter((s) => s !== 429).length).toBeLessThanOrEqual(60);
    expect(statuses.at(-1)).toBe(429);
  });
});
