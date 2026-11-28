import { describe, it, expect, beforeEach, vi } from "vitest";

const { release } = vi.hoisted(() => ({
  release: {
    findAll: vi.fn(),
    find: vi.fn(),
    updateAll: vi.fn(),
    createAndReturn: vi.fn(),
  },
}));

vi.mock("@/config", () => ({
  default: {
    launcher: {
      channel: "staging",
      publishTokenHash: "",
      downloadHosts: ["gitea.example.com"],
    },
    redis: { url: null },
  },
}));
vi.mock("@/db", () => ({ Q: { launcher: { release } } }));
vi.mock("@/db/utils", async () =>
  (await import("@/tests/helpers/mocks/db-utils")).dbUtilsMock(),
);

import {
  launcherReleaseService,
  type PublishLauncherReleaseInput,
} from "@/services/launcher/release/launcher-release.service";

const PLATFORM = "windows-x86_64";
const LINUX = "linux-x86_64";

type ReleaseRow = {
  id: number;
  version: string;
  platform: string;
  url: string;
  signature: string;
  size: number | null;
  notes: string;
  pubDate: Date;
  status: string;
  required: boolean;
  releasedAt: Date | null;
  withdrawnAt: Date | null;
  prunedAt: Date | null;
};

function released(
  version: string,
  required = false,
  platform = PLATFORM,
): ReleaseRow {
  return {
    id: Number(version.replaceAll(".", "")),
    version,
    platform,
    url: `https://gitea.example.com/launcher-${version}.exe`,
    signature: `signature-${version}`,
    size: null,
    notes: `Notes of ${version}`,
    pubDate: new Date("2026-10-01T10:00:00.000Z"),
    status: "released",
    required,
    releasedAt: new Date("2026-10-02T10:00:00.000Z"),
    withdrawnAt: null,
    prunedAt: null,
  };
}

function pruned(
  version: string,
  overrides: Partial<ReturnType<typeof released>> = {},
) {
  return {
    ...released(version),
    status: "pruned",
    prunedAt: new Date("2026-10-03T10:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(async () => {
  release.findAll.mockReset();
  release.find.mockReset();
  release.updateAll.mockReset();
  release.createAndReturn.mockReset();
  vi.unstubAllGlobals();
  await launcherReleaseService.clearCache();
});

describe("publish", () => {
  const INPUT: PublishLauncherReleaseInput = {
    channel: "staging",
    version: "0.3.0",
    platform: "windows-x86_64",
    url: "https://gitea.example.com/launcher-0.3.0.exe",
    signature: "signature-0.3.0",
    notes: "Notes of 0.3.0",
    pubDate: new Date("2026-10-01T10:00:00.000Z"),
  };

  function stubHead(headers: Record<string, string>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200, headers })),
    );
  }

  beforeEach(() => {
    release.findAll.mockResolvedValue([]);
    release.createAndReturn.mockImplementation(async (row) => ({
      id: 1,
      ...row,
    }));
  });

  it("refuses a size that differs from the length the download URL announces", async () => {
    stubHead({ "Content-Length": "7400001" });

    await expect(
      launcherReleaseService.publish({ ...INPUT, size: 7_400_000 }),
    ).rejects.toMatchObject({ code: "SIZE_MISMATCH", statusCode: 400 });
    expect(release.createAndReturn).not.toHaveBeenCalled();
  });

  it("stores a size that matches the announced length", async () => {
    stubHead({ "Content-Length": "7400000" });

    const stored = await launcherReleaseService.publish({
      ...INPUT,
      size: 7_400_000,
    });

    expect(stored.size).toBe(7_400_000);
  });

  it.each([
    ["announces no length", {}],
    [
      "announces the length of a compressed body",
      { "Content-Length": "100", "Content-Encoding": "gzip" },
    ],
  ])(
    "stores the size as given when the download URL %s",
    async (_label, headers) => {
      stubHead(headers);

      const stored = await launcherReleaseService.publish({
        ...INPUT,
        size: 7_400_000,
      });

      expect(stored.size).toBe(7_400_000);
    },
  );

  it("stores a release without a size whatever length the download URL announces", async () => {
    stubHead({ "Content-Length": "7400000" });

    const stored = await launcherReleaseService.publish(INPUT);

    expect(stored.size).toBeNull();
  });
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
      status: { $in: ["released", "pruned"] },
    });
  });

  it("names the size of the file when the release has one", async () => {
    release.findAll.mockResolvedValue([
      released("0.2.0"),
      { ...released("0.3.0"), size: 7_400_000 },
    ]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toEqual({
      version: "0.3.0",
      notes: "Notes of 0.3.0",
      pub_date: "2026-10-01T10:00:00.000Z",
      url: "https://gitea.example.com/launcher-0.3.0.exe",
      signature: "signature-0.3.0",
      size: 7_400_000,
      required: false,
    });
  });

  it("answers without a size for a release announced without one", async () => {
    release.findAll.mockResolvedValue([released("0.3.0")]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toEqual({
      version: "0.3.0",
      notes: "Notes of 0.3.0",
      pub_date: "2026-10-01T10:00:00.000Z",
      url: "https://gitea.example.com/launcher-0.3.0.exe",
      signature: "signature-0.3.0",
      required: false,
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
      status: { $in: ["released", "pruned"] },
    });
  });

  it("never offers a pruned version, even when it is the newest", async () => {
    release.findAll.mockResolvedValue([released("0.2.0"), pruned("0.3.0")]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toMatchObject({ version: "0.2.0" });
    expect(
      await launcherReleaseService.checkForUpdate(PLATFORM, "0.2.0"),
    ).toBeNull();
  });

  it("keeps the update required past a required release whose file was pruned", async () => {
    release.findAll.mockResolvedValue([
      pruned("0.2.0", { required: true }),
      released("0.3.0"),
    ]);

    const update = await launcherReleaseService.checkForUpdate(
      PLATFORM,
      "0.1.0",
    );

    expect(update).toMatchObject({ version: "0.3.0", required: true });
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

  it("is true past a pruned required release, as long as it was released and not withdrawn", async () => {
    release.findAll.mockResolvedValue([
      pruned("0.2.0", { required: true }),
      released("0.3.0"),
    ]);

    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0"),
    ).toBe(true);
  });

  it("ignores a pruned required version that was never released or was withdrawn", async () => {
    release.findAll.mockResolvedValue([
      pruned("0.2.0", { required: true, releasedAt: null }),
      pruned("0.3.0", {
        required: true,
        withdrawnAt: new Date("2026-10-02T12:00:00.000Z"),
      }),
      released("0.4.0"),
    ]);

    expect(
      await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0"),
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

describe("prune", () => {
  it("marks every version that is not on the bucket and forgets the cached releases", async () => {
    release.findAll.mockResolvedValueOnce([released("0.2.0")]);
    await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0");
    release.findAll.mockResolvedValueOnce([
      released("0.1.0"),
      released("0.1.0", false, LINUX),
    ]);
    release.updateAll.mockResolvedValue(2);

    const result = await launcherReleaseService.prune("staging", [
      "0.2.0",
      "0.3.0",
    ]);

    expect(release.findAll).toHaveBeenLastCalledWith({
      version: { $nin: ["0.2.0", "0.3.0"] },
      status: { $ne: "pruned" },
    });
    expect(release.updateAll).toHaveBeenCalledWith(
      { status: "pruned", prunedAt: expect.any(Date) },
      { id: { $in: [10, 10] } },
    );
    expect(result).toMatchObject([
      { version: "0.1.0", platform: PLATFORM, status: "pruned" },
      { version: "0.1.0", platform: LINUX, status: "pruned" },
    ]);

    release.findAll.mockResolvedValueOnce([]);
    await launcherReleaseService.isUpdateRequired(PLATFORM, "0.1.0");
    expect(release.findAll).toHaveBeenCalledTimes(3);
  });

  it("changes nothing when every stored version remains", async () => {
    release.findAll.mockResolvedValue([]);

    const result = await launcherReleaseService.prune("staging", ["0.2.0"]);

    expect(result).toEqual([]);
    expect(release.updateAll).not.toHaveBeenCalled();
  });

  it("refuses a report for the other channel without touching the database", async () => {
    await expect(
      launcherReleaseService.prune("production", ["0.2.0"]),
    ).rejects.toMatchObject({ code: "CHANNEL_MISMATCH" });

    expect(release.findAll).not.toHaveBeenCalled();
    expect(release.updateAll).not.toHaveBeenCalled();
  });
});
