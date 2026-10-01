import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

vi.mock("@/config", () => ({
  default: { envMode: { isProd: false, isDev: false } },
}));
vi.mock("@/db/utils", () => ({
  DatabaseError: class DatabaseError extends Error {},
  NotFoundError: class NotFoundError extends Error {},
  ConstraintViolationError: class ConstraintViolationError extends Error {},
  QueryError: class QueryError extends Error {},
}));

import { errorHandler } from "@/app/middleware/error-handler";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "1kb" }));
  app.post("/echo", (req, res) => {
    res.json({ success: true, data: req.body });
  });
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.restoreAllMocks();
});

async function post(body: string) {
  const res = await fetch(`${baseUrl}/echo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return { status: res.status, json: await res.json() };
}

function errorBody(statusCode: number, message: string) {
  return {
    success: false,
    message,
    error: { message, statusCode },
  };
}

describe("errorHandler with request body errors", () => {
  it.each([
    ["invalid JSON", "{bad"],
    ["a JSON null", "null"],
    ["a JSON string", '"text"'],
  ])("answers 400 for %s", async (_label, body) => {
    const errorLog = vi.spyOn(logger, "error");

    const { status, json } = await post(body);

    expect(status).toBe(400);
    expect(json).toEqual(errorBody(400, "Malformed JSON request body"));
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("answers 413 for a body over the limit", async () => {
    const errorLog = vi.spyOn(logger, "error");

    const { status, json } = await post(
      JSON.stringify({ data: "x".repeat(2048) }),
    );

    expect(status).toBe(413);
    expect(json).toEqual(errorBody(413, "Request body too large"));
    expect(errorLog).not.toHaveBeenCalled();
  });

  it("still accepts a valid object body", async () => {
    const { status, json } = await post('{"ok":true}');

    expect(status).toBe(200);
    expect(json).toEqual({ success: true, data: { ok: true } });
  });

  it("still answers 500 for an unexpected error", async () => {
    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(errorHandler);
    const errorLog = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const local = app.listen(0);
    await new Promise<void>((resolve) => local.once("listening", resolve));

    const res = await fetch(
      `http://127.0.0.1:${(local.address() as AddressInfo).port}/boom`,
    );
    await new Promise<void>((resolve) => local.close(() => resolve()));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(errorBody(500, "Internal Server Error"));
    expect(errorLog).toHaveBeenCalled();
  });
});
