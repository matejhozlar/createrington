import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import config from "@/config";
import { Q } from "@/db";
import {
  launcherReleaseService,
  type PublishLauncherReleaseInput,
} from "@/services/launcher/release/launcher-release.service";

const PLATFORM = "windows-x86_64";
const OWNER = "915110000000000001";
const HOST = "gitea.example.com";

const original = { ...config.launcher };

function setLauncherConfig(overrides: Partial<typeof config.launcher>): void {
  Object.assign(config.launcher, overrides);
}

function input(
  version: string,
  overrides: Partial<PublishLauncherReleaseInput> = {},
): PublishLauncherReleaseInput {
  return {
    channel: "staging",
    version,
    platform: PLATFORM,
    url: `https://${HOST}/packages/launcher/${version}/setup.exe`,
    signature: `signature-of-${version}`,
    notes: `Notes for ${version}`,
    pubDate: new Date("2026-09-29T18:00:00Z"),
    ...overrides,
  };
}

function stubDownload(status: number) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function publishAndRelease(version: string) {
  const release = await launcherReleaseService.publish(input(version));
  return await launcherReleaseService.release(release.id, OWNER);
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { code?: string; statusCode?: number };
  }
  throw new Error("Expected the call to be refused");
}

async function clearReleases(): Promise<void> {
  await Q.launcher.release.deleteAll({ platform: PLATFORM });
  launcherReleaseService.clearCache();
}

describe("LauncherReleaseService", () => {
  beforeEach(async () => {
    setLauncherConfig({ channel: "staging", downloadHosts: [HOST] });
    stubDownload(200);
    await clearReleases();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await clearReleases();
    setLauncherConfig(original);
  });

  describe("publish", () => {
    it("stores a new version as pending", async () => {
      const release = await launcherReleaseService.publish(input("0.2.0"));

      expect(release.status).toBe("pending");
      expect(release.version).toBe("0.2.0");
      expect(release.releasedAt).toBeNull();
    });

    it("stores the structured notes next to the text", async () => {
      const structuredNotes = {
        summary: "Faster start",
        changes: [
          {
            type: "improved",
            title: "Start time",
            description: "The launcher opens in half the time.",
          },
        ],
      };

      const release = await launcherReleaseService.publish(
        input("0.2.0", { structuredNotes }),
      );

      const stored = await Q.launcher.release.get({ id: release.id });
      expect(stored.notes).toBe("Notes for 0.2.0");
      expect(stored.structuredNotes).toEqual(structuredNotes);
    });

    it("stores no structured notes for a release announced without them", async () => {
      const release = await launcherReleaseService.publish(input("0.2.0"));

      expect(release.structuredNotes).toBeNull();
    });

    it("checks the download address with a HEAD request before storing", async () => {
      const fetchMock = stubDownload(200);

      await launcherReleaseService.publish(input("0.2.0"));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(input("0.2.0").url);
      expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
    });

    it("refuses the same version a second time", async () => {
      await launcherReleaseService.publish(input("0.2.0"));

      const error = await refusal(
        launcherReleaseService.publish(input("0.2.0")),
      );

      expect(error.code).toBe("DUPLICATE_VERSION");
      expect(error.statusCode).toBe(409);
      expect(await Q.launcher.release.count({ platform: PLATFORM })).toBe(1);
    });

    it("refuses a version that is not newer than the newest stored one", async () => {
      await launcherReleaseService.publish(input("0.10.0"));

      const error = await refusal(
        launcherReleaseService.publish(input("0.9.0")),
      );

      expect(error.code).toBe("NOT_NEWER");
    });

    it("counts pending and withdrawn versions when deciding what is newest", async () => {
      const withdrawn = await launcherReleaseService.publish(input("0.3.0"));
      await launcherReleaseService.withdraw(withdrawn.id, OWNER);

      const older = await refusal(
        launcherReleaseService.publish(input("0.2.0")),
      );
      const same = await refusal(
        launcherReleaseService.publish(input("0.3.0")),
      );

      expect(older.code).toBe("NOT_NEWER");
      expect(same.code).toBe("DUPLICATE_VERSION");
    });

    it("refuses a body for the other channel", async () => {
      const error = await refusal(
        launcherReleaseService.publish(
          input("0.2.0", { channel: "production" }),
        ),
      );

      expect(error.code).toBe("CHANNEL_MISMATCH");
      expect(error.statusCode).toBe(400);
    });

    it("refuses a staging build on a production environment", async () => {
      setLauncherConfig({ channel: "production" });

      const error = await refusal(
        launcherReleaseService.publish(input("0.2.0")),
      );

      expect(error.code).toBe("CHANNEL_MISMATCH");
    });

    it("refuses a download URL on a foreign host without contacting it", async () => {
      const fetchMock = stubDownload(200);

      const error = await refusal(
        launcherReleaseService.publish(
          input("0.2.0", { url: "https://evil.example.com/setup.exe" }),
        ),
      );

      expect(error.code).toBe("HOST_NOT_ALLOWED");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses a download URL that does not answer", async () => {
      stubDownload(404);

      const error = await refusal(
        launcherReleaseService.publish(input("0.2.0")),
      );

      expect(error.code).toBe("DOWNLOAD_UNREACHABLE");
      expect(await Q.launcher.release.count({ platform: PLATFORM })).toBe(0);
    });

    it("refuses a version that is not a semantic version", async () => {
      const error = await refusal(
        launcherReleaseService.publish(input("v0.2")),
      );

      expect(error.code).toBe("INVALID_VERSION");
    });
  });

  describe("checkForUpdate", () => {
    it("offers nothing while the newer version is only pending", async () => {
      await launcherReleaseService.publish(input("0.2.0"));

      expect(
        await launcherReleaseService.checkForUpdate(PLATFORM, "0.1.0"),
      ).toBeNull();
    });

    it("offers the version once the owner released it", async () => {
      const pending = await launcherReleaseService.publish(input("0.2.0"));
      await launcherReleaseService.checkForUpdate(PLATFORM, "0.1.0");

      await launcherReleaseService.release(pending.id, OWNER);

      expect(
        await launcherReleaseService.checkForUpdate(PLATFORM, "0.1.0"),
      ).toEqual({
        version: "0.2.0",
        notes: "Notes for 0.2.0",
        pub_date: "2026-09-29T18:00:00.000Z",
        url: input("0.2.0").url,
        signature: "signature-of-0.2.0",
      });
    });

    it("offers nothing to the newest released version", async () => {
      await publishAndRelease("0.2.0");

      expect(
        await launcherReleaseService.checkForUpdate(PLATFORM, "0.2.0"),
      ).toBeNull();
    });

    it("offers nothing to a launcher that is ahead of the newest release", async () => {
      await publishAndRelease("0.2.0");

      expect(
        await launcherReleaseService.checkForUpdate(PLATFORM, "0.3.0"),
      ).toBeNull();
    });

    it("sends a launcher several versions behind straight to the newest release", async () => {
      await publishAndRelease("0.2.0");
      await publishAndRelease("0.9.0");
      await publishAndRelease("0.10.0");

      const update = await launcherReleaseService.checkForUpdate(
        PLATFORM,
        "0.1.0",
      );

      expect(update?.version).toBe("0.10.0");
    });

    it("skips a newer version that is still pending and offers the newest released one", async () => {
      await publishAndRelease("0.2.0");
      await launcherReleaseService.publish(input("0.3.0"));

      const update = await launcherReleaseService.checkForUpdate(
        PLATFORM,
        "0.1.0",
      );

      expect(update?.version).toBe("0.2.0");
    });

    it("stops offering a withdrawn version and falls back to the one before", async () => {
      await publishAndRelease("0.2.0");
      const bad = await publishAndRelease("0.3.0");
      await launcherReleaseService.checkForUpdate(PLATFORM, "0.1.0");

      await launcherReleaseService.withdraw(bad.id, OWNER);

      const behind = await launcherReleaseService.checkForUpdate(
        PLATFORM,
        "0.1.0",
      );
      const onPrevious = await launcherReleaseService.checkForUpdate(
        PLATFORM,
        "0.2.0",
      );
      expect(behind?.version).toBe("0.2.0");
      expect(onPrevious).toBeNull();
    });

    it.each([
      ["an unknown platform", "linux-x86_64", "0.1.0"],
      ["an unreadable version", PLATFORM, "not-a-version"],
      ["an empty version", PLATFORM, ""],
    ])("answers nothing for %s", async (_label, platform, version) => {
      await publishAndRelease("0.2.0");

      expect(
        await launcherReleaseService.checkForUpdate(platform, version),
      ).toBeNull();
    });
  });

  describe("release and withdraw", () => {
    it("records who released a version and when", async () => {
      const pending = await launcherReleaseService.publish(input("0.2.0"));

      const released = await launcherReleaseService.release(pending.id, OWNER);

      expect(released.status).toBe("released");
      expect(released.releasedByDiscordId).toBe(OWNER);
      expect(released.releasedAt).toBeInstanceOf(Date);
    });

    it("refuses to release a version twice", async () => {
      const released = await publishAndRelease("0.2.0");

      const error = await refusal(
        launcherReleaseService.release(released.id, OWNER),
      );

      expect(error.code).toBe("INVALID_STATE");
      expect(error.statusCode).toBe(409);
    });

    it("refuses to release a withdrawn version again", async () => {
      const pending = await launcherReleaseService.publish(input("0.2.0"));
      await launcherReleaseService.withdraw(pending.id, OWNER);

      const error = await refusal(
        launcherReleaseService.release(pending.id, OWNER),
      );

      expect(error.code).toBe("INVALID_STATE");
      expect((await Q.launcher.release.find({ id: pending.id }))?.status).toBe(
        "withdrawn",
      );
    });

    it("refuses to withdraw a version twice", async () => {
      const released = await publishAndRelease("0.2.0");
      await launcherReleaseService.withdraw(released.id, OWNER);

      const error = await refusal(
        launcherReleaseService.withdraw(released.id, OWNER),
      );

      expect(error.code).toBe("INVALID_STATE");
    });

    it("answers NOT_FOUND for a release that does not exist", async () => {
      const error = await refusal(
        launcherReleaseService.release(2_000_000_000, OWNER),
      );

      expect(error.code).toBe("NOT_FOUND");
      expect(error.statusCode).toBe(404);
    });
  });

  describe("listReleased", () => {
    it("returns only released versions, highest version first", async () => {
      await publishAndRelease("0.2.0");
      await publishAndRelease("0.9.0");
      await publishAndRelease("0.10.0");
      const withdrawn = await publishAndRelease("0.11.0");
      await launcherReleaseService.withdraw(withdrawn.id, OWNER);
      await launcherReleaseService.publish(input("0.12.0"));

      const releases = (await launcherReleaseService.listReleased()).filter(
        (r) => r.platform === PLATFORM,
      );

      expect(releases.map((r) => r.version)).toEqual([
        "0.10.0",
        "0.9.0",
        "0.2.0",
      ]);
    });
  });

  describe("list", () => {
    it("returns every state, newest publish first", async () => {
      await publishAndRelease("0.2.0");
      const withdrawn = await launcherReleaseService.publish(input("0.3.0"));
      await launcherReleaseService.withdraw(withdrawn.id, OWNER);
      await launcherReleaseService.publish(input("0.4.0"));

      const releases = (await launcherReleaseService.list()).filter(
        (r) => r.platform === PLATFORM,
      );

      expect(releases.map((r) => [r.version, r.status])).toEqual([
        ["0.4.0", "pending"],
        ["0.3.0", "withdrawn"],
        ["0.2.0", "released"],
      ]);
    });
  });
});
