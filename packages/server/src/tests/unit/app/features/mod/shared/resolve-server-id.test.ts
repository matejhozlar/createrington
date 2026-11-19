import { describe, it, expect, vi } from "vitest";

vi.mock("@/services/playtime/config", () => ({
  getServerByIp: (ip: string) =>
    ip === "10.0.0.5"
      ? { serverId: 1, serverName: "Rails", ip, port: 26980 }
      : undefined,
  isValidServerId: (id: number) => id === 1 || id === 2,
}));

import { BadRequestError, InternalServerError } from "@/errors";
import { resolveServerId } from "@/app/features/mod/shared/resolve-server-id";
import { optionalServerId } from "@/app/features/mod/shared/sync-schemas";
import type { Request } from "express";
import { fakeReq } from "@/tests/helpers/http";

function makeReq(serverIp?: string): Request {
  return fakeReq({ serverIp });
}

describe("optionalServerId", () => {
  it("accepts a number, a numeric string, null or nothing", () => {
    expect(optionalServerId.parse(1)).toBe(1);
    expect(optionalServerId.parse("1")).toBe(1);
    expect(optionalServerId.parse(null)).toBeNull();
    expect(optionalServerId.parse(undefined)).toBeUndefined();
  });

  it("rejects a malformed serverId", () => {
    for (const value of ["abc", "1.5", 1.5, true]) {
      expect(optionalServerId.safeParse(value).success).toBe(false);
    }
  });
});

describe("resolveServerId", () => {
  it("returns the IP-derived server when the body has no serverId", () => {
    expect(resolveServerId(makeReq("10.0.0.5"), undefined, "test")).toBe(1);
    expect(resolveServerId(makeReq("10.0.0.5"), null, "test")).toBe(1);
  });

  it("accepts a body serverId matching the IP-derived server", () => {
    expect(resolveServerId(makeReq("10.0.0.5"), 1, "test")).toBe(1);
  });

  it("rejects a configured body serverId that does not match the IP-derived server", () => {
    expect(() => resolveServerId(makeReq("10.0.0.5"), 2, "test")).toThrow(
      BadRequestError,
    );
  });

  it("rejects a body serverId that is not a configured server", () => {
    expect(() => resolveServerId(makeReq("10.0.0.5"), 999, "test")).toThrow(
      BadRequestError,
    );
  });

  it("accepts a configured body serverId when the IP has no mapping (local dev)", () => {
    expect(resolveServerId(makeReq("127.0.0.1"), 1, "test")).toBe(1);
  });

  it("rejects an unmapped IP when the body has no serverId", () => {
    expect(() =>
      resolveServerId(makeReq("127.0.0.1"), undefined, "test"),
    ).toThrow(BadRequestError);
  });

  it("throws when the middleware did not attach a server IP", () => {
    expect(() => resolveServerId(makeReq(), undefined, "test")).toThrow(
      InternalServerError,
    );
    expect(() => resolveServerId(makeReq(), 1, "test")).toThrow(
      InternalServerError,
    );
  });
});
