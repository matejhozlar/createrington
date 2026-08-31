import { describe, it, expect, vi } from "vitest";

// resolve-server-id pulls the middleware barrel for its error classes; the
// barrel drags in config/db-backed middleware, so substitute just the
// error-handler module the helper actually needs.
vi.mock("@/app/middleware", () =>
  vi.importActual("@/app/middleware/error-handler"),
);

// Two configured servers (ids 1 and 2); only server 1 has an IP mapping so
// both the mismatch branch and the unmapped-IP fallback are reachable.
vi.mock("@/services/playtime/config", () => ({
  getServerByIp: (ip: string) =>
    ip === "10.0.0.5"
      ? { serverId: 1, serverName: "Rails", ip, port: 26980 }
      : undefined,
  isValidServerId: (id: number) => id === 1 || id === 2,
}));

import {
  BadRequestError,
  InternalServerError,
} from "@/app/middleware/error-handler";
import { resolveServerId } from "@/app/features/mod/shared/resolve-server-id";
import type { Request } from "express";

function makeReq(body: unknown, serverIp?: string): Request {
  return { body, serverIp } as unknown as Request;
}

describe("resolveServerId", () => {
  it("returns the IP-derived server when the body has no serverId", () => {
    expect(resolveServerId(makeReq({}, "10.0.0.5"), "test")).toBe(1);
  });

  it("accepts a body serverId matching the IP-derived server", () => {
    expect(resolveServerId(makeReq({ serverId: 1 }, "10.0.0.5"), "test")).toBe(
      1,
    );
  });

  it("accepts a numeric-string body serverId matching the IP-derived server", () => {
    expect(
      resolveServerId(makeReq({ serverId: "1" }, "10.0.0.5"), "test"),
    ).toBe(1);
  });

  it("rejects a configured body serverId that does not match the IP-derived server", () => {
    expect(() =>
      resolveServerId(makeReq({ serverId: 2 }, "10.0.0.5"), "test"),
    ).toThrow(BadRequestError);
  });

  it("rejects a body serverId that is not a configured server", () => {
    expect(() =>
      resolveServerId(makeReq({ serverId: 999 }, "10.0.0.5"), "test"),
    ).toThrow(BadRequestError);
  });

  it("rejects a malformed body serverId", () => {
    expect(() =>
      resolveServerId(makeReq({ serverId: "abc" }, "10.0.0.5"), "test"),
    ).toThrow(BadRequestError);
  });

  it("accepts a configured body serverId when the IP has no mapping (local dev)", () => {
    expect(resolveServerId(makeReq({ serverId: 1 }, "127.0.0.1"), "test")).toBe(
      1,
    );
  });

  it("rejects an unmapped IP when the body has no serverId", () => {
    expect(() => resolveServerId(makeReq({}, "127.0.0.1"), "test")).toThrow(
      BadRequestError,
    );
  });

  it("throws when the middleware did not attach a server IP", () => {
    expect(() => resolveServerId(makeReq({}), "test")).toThrow(
      InternalServerError,
    );
  });
});
