import { describe, it, expect, beforeEach, vi } from "vitest";

const { release } = vi.hoisted(() => ({
  release: {
    findAll: vi.fn(),
    find: vi.fn(),
    updateAll: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    launcher: {
      channel: "staging",
      publishTokenHash: "",
      downloadHosts: [],
    },
  },
}));
vi.mock("@/db", () => ({ Q: { launcher: { release } } }));
vi.mock("@/db/utils", () => ({
  UniqueViolationError: class UniqueViolationError extends Error {},
}));

import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";

const PLATFORM = "windows-x86_64";
const LINUX = "linux-x86_64";

function released(version: string, required = false, platform = PLATFORM) {
  return {
    id: Number(version.replaceAll(".", "")),
    version,
    platform,
    url: `https://gitea.example.com/launcher-${version}.exe`,
    signature: `signature-${version}`,
    notes: `Notes of ${version}`,
    pubDate: new Date("2026-10-01T10:00:00.000Z"),
    status: "released",
    required,
  };
}

beforeEach(() => {
  release.findAll.mockReset();
  release.find.mockReset();
  release.updateAll.mockReset();
  launcherReleaseService.clearCache();
});

describe("checkForUpdate", () => {
  it("offers the newest released version and only reads released ones", async () => {
    release.findAll.mockResolvedValue([released("0.2.0"), released("0.3.0")]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toMatchObject({ version: "0.3.0", required: false });
    expect(release.findAll).toHaveBeenCalledWith({
      platform: PLATFORM,
      status: "released",
    });
  });

  it("says the update is required when a required release lies between the launcher and the newest", async () => {
    release.findAll.mockResolvedValue([
      released("0.2.0", true),
      released("0.3.0"),
    ]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toMatchObject({ version: "0.3.0", required: true });
  });

  it("offers an optional update to a launcher that already has the required release", async () => {
    release.findAll.mockResolvedValue([
      released("0.2.0", true),
      released("0.3.0"),
    ]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.2.0",
    );

    expect(update).toMatchObject({ version: "0.3.0", required: false });
  });

  it("answers a Linux launcher from the Linux releases only", async () => {
    release.findAll.mockImplementation(async ({ platform }) =>
      platform === LINUX
        ? [released("0.2.0", false, LINUX)]
        : [released("0.2.0"), released("0.3.0", true)],
    );

    const linux = await launcherReleaseService.checkForUpdate(LINUX, "0.1.0");
    const windows = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(linux).toMatchObject({ version: "0.2.0", required: false });
    expect(windows).toMatchObject({ version: "0.3.0", required: true });
    expect(release.findAll).toHaveBeenCalledWith({
      platform: LINUX,
      status: "released",
    });
  });

  it("has nothing for a launcher on the newest release, required or not", async () => {
    release.findAll.mockResolvedValue([released("0.3.0", true)]);

    expect(
      await launcherReleaseService.checkForUpdate(PLATFORM, "0.3.0"),
    ).toBeNull();
  });
});

describe("isUpdateRequired", () => {
  it("is true for a launcher older than the newest required release", async () => {
    release.findAll.mockResolvedValue([
      released("0.2.0", true),
      released("0.4.0", true),
      released("0.5.0"),
    ]);

    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.3.0"),
    ).toBe(true);
  });

  it("is false for a launcher on the newest required release or a newer one", async () => {
    release.findAll.mockResolvedValue([
      released("0.2.0", true),
      released("0.3.0"),
    ]);

    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.2.0"),
    ).toBe(false);
    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.2.5"),
    ).toBe(false);
  });

  it("is false while no released version is required", async () => {
    release.findAll.mockResolvedValue([released("0.2.0"), released("0.3.0")]);

    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0"),
    ).toBe(false);
  });

  it("judges a launcher by the required releases of its own platform", async () => {
    release.findAll.mockImplementation(async ({ platform }) =>
      platform === LINUX
        ? [released("0.3.0", true, LINUX)]
        : [released("0.3.0")],
    );

    expect(await launcherReleaseService.isUpdateRequired(LINUX, "0.2.0")).toBe(
      true,
    );
    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.2.0"),
    ).toBe(false);
  });

  it("is false for a platform or a version it cannot read, without asking the database", async () => {
    expect(
      await launcherReleaseService.isUpdateRequired("amiga-68k", "0.1.0"),
    ).toBe(false);
    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "not-a-version"),
    ).toBe(false);
    expect(release.findAll).not.toHaveBeenCalled();
  });

  it("reads the releases once for several checks in a row", async () => {
    release.findAll.mockResolvedValue([released("0.2.0", true)]);

    await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0");
    await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.5");
    await launcherReleaseService.checkForUpdate(PLATFORM, "0.1.0");

    expect(release.findAll).toHaveBeenCalledTimes(1);
  });
});

describe("release", () => {
  it("stores whether the version is required and forgets the cached releases", async () => {
    release.findAll.mockResolvedValue([released("0.2.0")]);
    await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0");
    release.updateAll.mockResolvedValue(1);
    release.find.mockResolvedValue(released("0.3.0", true));

    const result = await launcherReleaseService.release(30, "owner", true);

    expect(result.required).toBe(true);
    expect(release.updateAll).toHaveBeenCalledWith(
      expect.objectContaining({ status: "released", required: true }),
      { id: 30, status: "pending" },
    );

    release.findAll.mockResolvedValue([
      released("0.2.0"),
      released("0.3.0", true),
    ]);
    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0"),
    ).toBe(true);
  });

  it("releases a version as optional unless told otherwise", async () => {
    release.updateAll.mockResolvedValue(1);
    release.find.mockResolvedValue(released("0.3.0"));

    await launcherReleaseService.release(30, "owner");

    expect(release.updateAll).toHaveBeenCalledWith(
      expect.objectContaining({ required: false }),
      { id: 30, status: "pending" },
    );
  });
});
