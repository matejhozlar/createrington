import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

vi.mock("@/services/redis", () => ({
  redisService: { enabled: false, isReady: false },
}));

import express from "express";
import {
  launcherPackLimiter,
  messageSendLimiter,
} from "@/app/middleware/rate-limit.middleware";

const uploadStandIn = vi.fn((_req, res) => res.status(201).end());
const packStandIn = vi.fn((_req, res) => res.status(200).end());

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
  app.get(
    "/api/launcher/packs",
    (req, _res, next) => {
      const minecraftUuid = req.header("x-player");
      if (minecraftUuid) {
        req.launcherAuth = { minecraftUuid } as typeof req.launcherAuth;
      }
      next();
    },
    launcherPackLimiter,
    packStandIn,
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

function askPacks(player?: string): Promise<Response> {
  return fetch(`${baseUrl}/api/launcher/packs`, {
    headers: player ? { "x-player": player } : {},
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

describe("launcherPackLimiter", () => {
  it("gives each launcher player 120 pack requests per window, apart from the others on the same IP", async () => {
    const alice = "069a79f4-44e9-4726-a5be-fca90e38aaf5";
    const bob = "61699b2e-d327-4a01-9f1e-0ea8c3f06bc6";
    for (let i = 0; i < 120; i++) {
      expect((await askPacks(alice)).status).toBe(200);
    }

    const limited = await askPacks(alice);

    expect(limited.status).toBe(429);
    expect(packStandIn).toHaveBeenCalledTimes(120);
    expect((await askPacks(bob)).status).toBe(200);
    expect((await askPacks()).status).toBe(200);
  });
});
