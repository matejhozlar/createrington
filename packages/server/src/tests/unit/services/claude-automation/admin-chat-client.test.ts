import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";

const adminChat = vi.hoisted(() => ({
  url: "",
  secret: "s".repeat(32),
}));

vi.mock("@/config", () => ({
  default: {
    envMode: { isProd: false, isDev: false, isDevDeployment: true },
    adminChat,
  },
}));

import { adminChatClient } from "@/services/claude-automation/admin-chat-client";

interface UpstreamRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  secret: string | undefined;
  body: unknown;
}

type UpstreamHandler = (req: IncomingMessage, res: ServerResponse) => void;

let upstream: Server;
let upstreamUrl: string;
let seen: UpstreamRequest[];
let respond: UpstreamHandler;

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function answerJson(status: number, body: unknown): UpstreamHandler {
  return (_req, res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
}

beforeAll(async () => {
  upstream = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://upstream.test");
      const text = Buffer.concat(chunks).toString();
      seen.push({
        method: req.method ?? "",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        secret: req.headers["x-admin-chat-secret"] as string | undefined,
        body: text ? JSON.parse(text) : undefined,
      });
      respond(req, res);
    });
  });
  upstreamUrl = await listen(upstream);
});

afterAll(async () => {
  await close(upstream);
});

beforeEach(() => {
  seen = [];
  adminChat.url = upstreamUrl;
  respond = answerJson(200, {});
});

describe("adminChatClient", () => {
  it("reports admin chat as disabled without calling upstream when it is not configured", async () => {
    adminChat.url = "";

    await expect(adminChatClient.enabled()).resolves.toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("refuses with 503 when claude-automation is not configured", async () => {
    adminChat.url = "";

    await expect(adminChatClient.repos()).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(seen).toHaveLength(0);
  });

  it("asks for this app and environment with the shared secret", async () => {
    respond = answerJson(200, { enabled: true });

    await expect(adminChatClient.enabled()).resolves.toBe(true);
    expect(seen).toEqual([
      {
        method: "GET",
        path: "/api/chat/enabled",
        query: { repo: "Createrington/app", environment: "dev" },
        secret: "s".repeat(32),
        body: undefined,
      },
    ]);
  });

  it("returns the running session with its model", async () => {
    respond = answerJson(200, {
      active: true,
      sessionId: 7,
      model: "claude-opus-5-5",
    });

    await expect(adminChatClient.currentSession("matej")).resolves.toEqual({
      id: 7,
      active: true,
      model: "claude-opus-5-5",
    });
    expect(seen[0]?.query).toEqual({ username: "matej", environment: "dev" });
  });

  it("falls back to the last finished session and drops a model the app does not offer", async () => {
    respond = answerJson(200, {
      active: false,
      sessionId: null,
      lastSessionId: 4,
      lastSessionModel: "claude-sonnet-5-5",
    });

    await expect(adminChatClient.currentSession("matej")).resolves.toEqual({
      id: 4,
      active: false,
      model: null,
    });
  });

  it("pages finished sessions and leaves out an unset cursor", async () => {
    const session = {
      id: 3,
      status: "completed",
      title: "Page: /admin",
      createdAt: "2026-11-01T00:00:00.000Z",
      completedAt: null,
      lastActivityAt: null,
      messageCount: 2,
    };
    respond = answerJson(200, { sessions: [session], nextCursor: 3 });

    await expect(
      adminChatClient.sessions("matej", { limit: 25 }),
    ).resolves.toEqual({ items: [session], nextCursor: 3 });
    expect(seen[0]).toMatchObject({
      path: "/api/chat/sessions",
      query: { username: "matej", environment: "dev", limit: "25" },
    });
  });

  it("sends a message with the username added", async () => {
    respond = answerJson(200, { messageId: 3 });

    await adminChatClient.send("matej", { sessionId: 9, message: "hello" });

    expect(seen[0]).toMatchObject({
      method: "POST",
      path: "/api/chat/send",
      body: { username: "matej", sessionId: 9, message: "hello" },
    });
  });

  it("starts a session for this app and environment", async () => {
    respond = answerJson(200, { sessionId: 12, model: "claude-opus-5-5" });

    await expect(adminChatClient.start("matej", {})).resolves.toEqual({
      sessionId: 12,
      model: "claude-opus-5-5",
    });
    expect(seen[0]).toMatchObject({
      path: "/api/chat/start",
      body: {
        username: "matej",
        repo: "Createrington/app",
        environment: "dev",
      },
    });
  });

  it("fails a start that comes back without a session id", async () => {
    await expect(adminChatClient.start("matej", {})).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("refuses with the upstream status and its error as the message", async () => {
    respond = answerJson(404, { error: "No active chat session" });

    await expect(adminChatClient.end("matej", 9)).rejects.toMatchObject({
      statusCode: 404,
      message: "No active chat session",
    });
  });

  it("fails with 500 when claude-automation cannot be reached", async () => {
    const unused = createServer();
    adminChat.url = await listen(unused);
    await close(unused);

    await expect(adminChatClient.repos()).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
