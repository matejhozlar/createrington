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
import type { NextFunction, Request, Response } from "express";

const env = vi.hoisted(() => ({
  CLAUDE_API_URL: "",
  ADMIN_CHAT_SECRET: "s".repeat(32),
}));

vi.mock("@/config", () => ({
  default: { envMode: { isProd: false, isDev: false } },
}));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
}));
vi.mock("@/config/env/env.config", () => ({
  env,
  envMode: { isDevDeployment: true },
}));
vi.mock("@/app/middleware", async () => ({
  ...(await vi.importActual("@/app/middleware/error-handler")),
  ...(await vi.importActual("@/app/middleware/async-handler")),
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { minecraftUsername: "matej" } as Request["user"];
    next();
  },
  requireAdmin: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import express from "express";
import { errorHandler } from "@/app/middleware/error-handler";
import adminChatRoutes from "@/app/features/admin-chat/admin-chat.routes";

interface UpstreamRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  secret: string | undefined;
  body: unknown;
}

type UpstreamHandler = (req: IncomingMessage, res: ServerResponse) => void;

let app: Server;
let upstream: Server;
let appUrl: string;
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

  const server = express();
  server.use(express.json());
  server.use("/api/admin/chat", adminChatRoutes);
  server.use(errorHandler);
  app = createServer(server);
  appUrl = await listen(app);
});

afterAll(async () => {
  await close(app);
  await close(upstream);
});

beforeEach(() => {
  seen = [];
  env.CLAUDE_API_URL = upstreamUrl;
  respond = answerJson(200, { ok: true });
});

function chat(path: string, init?: RequestInit): Promise<globalThis.Response> {
  return fetch(`${appUrl}/api/admin/chat${path}`, init);
}

function postJson(path: string, body: unknown): Promise<globalThis.Response> {
  return chat(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin chat proxy", () => {
  it("answers 503 when claude-automation is not configured", async () => {
    env.CLAUDE_API_URL = "";

    const res = await chat("/enabled");

    expect(res.status).toBe(503);
    expect(seen).toHaveLength(0);
  });

  it("forwards a GET with its query and the shared secret", async () => {
    respond = answerJson(200, { enabled: true });

    const res = await chat("/enabled");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ enabled: true });
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

  it("takes the username from the session and forwards only string query values", async () => {
    await chat("/sessions?limit=20&cursor=a&cursor=b");

    expect(seen[0]?.path).toBe("/api/chat/sessions");
    expect(seen[0]?.query).toEqual({
      username: "matej",
      environment: "dev",
      limit: "20",
    });
  });

  it("forwards a POST body with the username added", async () => {
    respond = answerJson(200, { messageId: 3 });

    const res = await postJson("/send", { sessionId: 9, message: "hello" });

    await expect(res.json()).resolves.toEqual({ messageId: 3 });
    expect(seen[0]).toMatchObject({
      method: "POST",
      path: "/api/chat/send",
      body: { username: "matej", sessionId: 9, message: "hello" },
    });
  });

  it("rejects a messages request without a session id before calling upstream", async () => {
    const res = await chat("/messages");

    expect(res.status).toBe(400);
    expect(seen).toHaveLength(0);
  });

  it("passes an upstream error status and body through", async () => {
    respond = answerJson(403, { error: "admin chat is switched off" });

    const res = await chat("/enabled");

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "admin chat is switched off",
    });
  });

  it("answers 500 when claude-automation cannot be reached", async () => {
    const unused = createServer();
    env.CLAUDE_API_URL = await listen(unused);
    await close(unused);

    const res = await chat("/enabled");

    expect(res.status).toBe(500);
  });
});

describe("admin chat stream", () => {
  it("passes an upstream rejection through with its status and body", async () => {
    respond = answerJson(404, { error: "session not found" });

    const res = await chat("/stream?sessionId=9");

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "session not found" });
    expect(seen[0]?.query).toEqual({ username: "matej", sessionId: "9" });
  });

  it("delivers each event while the upstream stream is still open", async () => {
    let finish = () => {};
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: first\n\n");
      finish = () => res.end("data: last\n\n");
    };

    const res = await chat("/stream?sessionId=9");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(decoder.decode(first.value)).toBe("data: first\n\n");

    finish();
    let rest = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += decoder.decode(chunk.value);
    }
    expect(rest).toBe("data: last\n\n");
  });

  it("closes the upstream connection quietly when the client disconnects", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => logger);
    let upstreamClosed: () => void = () => {};
    const closed = new Promise<void>((resolve) => {
      upstreamClosed = resolve;
    });
    respond = (_req, res) => {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      res.write("data: first\n\n");
      res.on("close", upstreamClosed);
    };

    const controller = new AbortController();
    const res = await chat("/stream?sessionId=9", {
      signal: controller.signal,
    });
    await res.body!.getReader().read();
    controller.abort();

    await expect(closed).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it("closes the upstream connection when the client leaves before the upstream answers", async () => {
    const logged = vi.spyOn(logger, "error").mockImplementation(() => logger);
    let upstreamClosed: () => void = () => {};
    const closed = new Promise<void>((resolve) => {
      upstreamClosed = resolve;
    });
    let upstreamReached: () => void = () => {};
    const reached = new Promise<void>((resolve) => {
      upstreamReached = resolve;
    });
    respond = (_req, res) => {
      res.on("close", upstreamClosed);
      upstreamReached();
    };

    const controller = new AbortController();
    const pending = chat("/stream?sessionId=9", {
      signal: controller.signal,
    }).catch(() => null);
    await reached;
    controller.abort();
    await pending;

    await expect(closed).resolves.toBeUndefined();
    await new Promise((resolve) => setImmediate(resolve));
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});
