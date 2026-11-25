import { describe, it, expect, vi } from "vitest";
import { spaFallback } from "@/app/spa-fallback";
import { fakeReq } from "@/tests/helpers/http";
import type { Response } from "express";

function request(path: string) {
  const res = { setHeader: vi.fn(), sendFile: vi.fn() };
  const next = vi.fn();
  spaFallback("/srv/public/index.html")(
    fakeReq({ path }),
    res as unknown as Response,
    next,
  );
  return { res, next };
}

describe("spaFallback", () => {
  it.each(["/", "/leaderboards", "/admin/tools", "/apiary", "/trpcx"])(
    "serves the client shell for %s",
    (path) => {
      const { res, next } = request(path);

      expect(res.sendFile).toHaveBeenCalledWith("/srv/public/index.html");
      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
      expect(next).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/api",
    "/api/launcher/packs",
    "/api/claude-chat/stream",
    "/trpc/servers.list",
    "/socket.io/",
  ])("leaves %s to the not-found handler", (path) => {
    const { res, next } = request(path);

    expect(next).toHaveBeenCalledWith();
    expect(res.sendFile).not.toHaveBeenCalled();
  });
});
