import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const { isUpdateRequired } = vi.hoisted(() => ({
  isUpdateRequired: vi.fn(),
}));

vi.mock("@/services/launcher/release/launcher-release.service", () => ({
  launcherReleaseService: { isUpdateRequired },
}));

import { AppError } from "@/app/middleware/error-handler";
import { requireSupportedLauncher } from "@/app/middleware/launcher-version.middleware";

function makeReq(headers: Record<string, string>): Request {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
  );
  return { get: (name: string) => lower[name.toLowerCase()] } as Request;
}

async function run(headers: Record<string, string>) {
  const next = vi.fn<(error?: unknown) => void>();
  await requireSupportedLauncher(
    makeReq(headers),
    {} as Response,
    next as NextFunction,
  );
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]?.[0] as AppError | undefined;
}

beforeEach(() => {
  isUpdateRequired.mockReset();
  isUpdateRequired.mockResolvedValue(false);
});

describe("requireSupportedLauncher", () => {
  it("lets a request without a launcher version through, without looking anything up", async () => {
    expect(await run({})).toBeUndefined();
    expect(
      await run({ "X-Launcher-Platform": "windows-x86_64" }),
    ).toBeUndefined();
    expect(isUpdateRequired).not.toHaveBeenCalled();
  });

  it("lets a request without a launcher platform through", async () => {
    expect(await run({ "X-Launcher-Version": "0.1.0" })).toBeUndefined();
    expect(isUpdateRequired).not.toHaveBeenCalled();
  });

  it("lets a launcher through that is new enough", async () => {
    const error = await run({
      "X-Launcher-Version": "0.3.0",
      "X-Launcher-Platform": "windows-x86_64",
    });

    expect(error).toBeUndefined();
    expect(isUpdateRequired).toHaveBeenCalledWith("windows-x86_64", "0.3.0");
  });

  it("answers 426 UPDATE_REQUIRED to a launcher older than a required release", async () => {
    isUpdateRequired.mockResolvedValue(true);

    const error = await run({
      "x-launcher-version": "0.1.0",
      "x-launcher-platform": "windows-x86_64",
    });

    expect(error).toBeInstanceOf(AppError);
    expect(error?.statusCode).toBe(426);
    expect(error?.code).toBe("UPDATE_REQUIRED");
  });

  it("lets the request through when the releases cannot be read", async () => {
    isUpdateRequired.mockRejectedValue(new Error("database down"));

    const error = await run({
      "X-Launcher-Version": "0.1.0",
      "X-Launcher-Platform": "windows-x86_64",
    });

    expect(error).toBeUndefined();
  });
});
