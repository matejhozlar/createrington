import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

vi.mock("@/services/redis", () => ({
  redisService: { enabled: false, isReady: false },
}));

import express from "express";
import { messageSendLimiter } from "@/app/middleware/rate-limit.middleware";

const uploadStandIn = vi.fn((_req, res) => res.status(201).end());

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.post(
    "/api/messages",
    (req, _res, next) => {
      req.user = { discordId: req.header("x-user") } as typeof req.user;
      next();
    },
    messageSendLimiter,
    uploadStandIn,
  );
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function send(user: string): Promise<Response> {
  return fetch(`${baseUrl}/api/messages`, {
    method: "POST",
    headers: { "x-user": user },
  });
}

describe("messageSendLimiter", () => {
  it("allows 20 messages a minute per user and stops the 21st before the upload runs", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await send("100000000000000001")).status).toBe(201);
    }

    const limited = await send("100000000000000001");

    expect(limited.status).toBe(429);
    expect(uploadStandIn).toHaveBeenCalledTimes(20);
    expect((await send("100000000000000002")).status).toBe(201);
  });
});
