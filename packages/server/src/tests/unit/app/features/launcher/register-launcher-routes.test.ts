import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Express } from "express";

const { launcher, jwtEnabled, publishEnabled } = vi.hoisted(() => ({
  launcher: { available: true },
  jwtEnabled: { value: true },
  publishEnabled: { value: true },
}));

vi.mock("@/config", () => ({ default: { launcher } }));
vi.mock("@/app/middleware/launcher-version.middleware", () => ({
  requireSupportedLauncher: "requireSupportedLauncher",
}));
vi.mock("@/services/auth/launcher/launcher-jwt.service", () => ({
  launcherJwtService: { isEnabled: () => jwtEnabled.value },
}));
vi.mock("@/services/launcher/release/launcher-release.service", () => ({
  launcherReleaseService: { isEnabled: () => publishEnabled.value },
}));
vi.mock("@/app/features/launcher/auth/launcher-auth.routes", () => ({
  default: "authRoutes",
}));
vi.mock("@/app/features/launcher/content/launcher-content.routes", () => ({
  default: "contentRoutes",
}));
vi.mock("@/app/features/launcher/pack/launcher-pack.routes", () => ({
  default: "packRoutes",
}));
vi.mock("@/app/features/launcher/releases/launcher-release.routes", () => ({
  launcherPublishRoutes: "publishRoutes",
  launcherUpdateCheckRoutes: "updateCheckRoutes",
}));

import { registerLauncherRoutes } from "@/app/features/launcher";

function mountedPaths(): string[] {
  const app = { use: vi.fn() };
  registerLauncherRoutes(app as unknown as Express, "/api");
  return app.use.mock.calls.map(([path]) => path as string);
}

describe("registerLauncherRoutes", () => {
  beforeEach(() => {
    launcher.available = true;
    jwtEnabled.value = true;
    publishEnabled.value = true;
  });

  it("mounts every launcher route where the launcher is available", () => {
    expect(mountedPaths()).toEqual([
      "/api/launcher/auth",
      "/api/launcher/packs",
      "/api/launcher/content",
      "/api/launcher",
      "/api/launcher",
    ]);
  });

  it("mounts no launcher route on the production deployment, even with the launcher secrets set", () => {
    launcher.available = false;

    expect(mountedPaths()).toEqual([]);
  });

  it("keeps the update check alone when the launcher secrets are unset", () => {
    jwtEnabled.value = false;
    publishEnabled.value = false;

    expect(mountedPaths()).toEqual(["/api/launcher"]);
  });
});
