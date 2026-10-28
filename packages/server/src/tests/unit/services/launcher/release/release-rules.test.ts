import { describe, it, expect } from "vitest";
import {
  groupByVersion,
  isDownloadUrlAllowed,
  isNewerVersion,
  isValidVersion,
  mergeVersionBuilds,
  newestFirst,
  newestVersion,
} from "@/services/launcher/release/release-rules";

describe("isValidVersion", () => {
  it.each(["0.1.2", "1.0.0", "10.20.30", "1.0.0-beta.1"])(
    "accepts %s",
    (version) => {
      expect(isValidVersion(version)).toBe(true);
    },
  );

  it.each(["", "1", "1.2", "v1.2.3", " 1.2.3", "1.2.3 ", "latest", "01.2.3"])(
    "rejects %j",
    (version) => {
      expect(isValidVersion(version)).toBe(false);
    },
  );
});

describe("isNewerVersion", () => {
  it.each([
    ["0.1.3", "0.1.2"],
    ["0.2.0", "0.1.9"],
    ["1.0.0", "0.99.99"],
    ["0.10.0", "0.9.0"],
    ["1.0.0", "1.0.0-beta.1"],
    ["1.0.0-beta.2", "1.0.0-beta.1"],
  ])("%s is newer than %s", (candidate, than) => {
    expect(isNewerVersion(candidate, than)).toBe(true);
  });

  it.each([
    ["0.1.2", "0.1.2"],
    ["0.1.2", "0.1.3"],
    ["0.9.0", "0.10.0"],
    ["1.0.0-beta.1", "1.0.0"],
  ])("%s is not newer than %s", (candidate, than) => {
    expect(isNewerVersion(candidate, than)).toBe(false);
  });
});

describe("newestVersion", () => {
  it("picks by version order, not by list order or text order", () => {
    const releases = [
      { version: "0.9.0" },
      { version: "0.10.0" },
      { version: "0.2.5" },
    ];

    expect(newestVersion(releases)).toEqual({ version: "0.10.0" });
  });

  it("returns null for an empty list", () => {
    expect(newestVersion([])).toBeNull();
  });

  it("skips entries whose version cannot be read", () => {
    const releases = [{ version: "garbage" }, { version: "0.1.0" }];

    expect(newestVersion(releases)).toEqual({ version: "0.1.0" });
  });
});

describe("newestFirst", () => {
  it("orders by version, not by list order or text order", () => {
    const releases = [
      { version: "0.9.0" },
      { version: "0.10.0" },
      { version: "0.2.5" },
    ];

    expect(newestFirst(releases).map((r) => r.version)).toEqual([
      "0.10.0",
      "0.9.0",
      "0.2.5",
    ]);
  });

  it("drops entries whose version cannot be read", () => {
    const releases = [{ version: "garbage" }, { version: "0.1.0" }];

    expect(newestFirst(releases)).toEqual([{ version: "0.1.0" }]);
  });

  it("leaves the given list untouched", () => {
    const releases = [{ version: "0.1.0" }, { version: "0.2.0" }];

    newestFirst(releases);

    expect(releases.map((r) => r.version)).toEqual(["0.1.0", "0.2.0"]);
  });
});

describe("groupByVersion", () => {
  it("puts the builds of one version together, highest version first", () => {
    const releases = [
      { version: "0.9.0", platform: "windows-x86_64" },
      { version: "0.10.0", platform: "linux-x86_64" },
      { version: "0.9.0", platform: "linux-x86_64" },
      { version: "0.10.0", platform: "windows-x86_64" },
    ];

    expect(groupByVersion(releases)).toEqual([
      [
        { version: "0.10.0", platform: "linux-x86_64" },
        { version: "0.10.0", platform: "windows-x86_64" },
      ],
      [
        { version: "0.9.0", platform: "windows-x86_64" },
        { version: "0.9.0", platform: "linux-x86_64" },
      ],
    ]);
  });

  it("keeps a version that only one platform has", () => {
    const releases = [
      { version: "0.2.0", platform: "windows-x86_64" },
      { version: "0.1.0", platform: "windows-x86_64" },
      { version: "0.1.0", platform: "linux-x86_64" },
    ];

    expect(groupByVersion(releases).map((builds) => builds.length)).toEqual([
      1, 2,
    ]);
  });

  it("returns no groups for an empty list", () => {
    expect(groupByVersion([])).toEqual([]);
  });
});

describe("mergeVersionBuilds", () => {
  const PLATFORMS = ["windows-x86_64", "linux-x86_64"];

  function build(platform: string, releasedAt: string | null = null) {
    return {
      platform,
      notes: `Notes of the ${platform} build`,
      releasedAt: releasedAt ? new Date(releasedAt) : null,
    };
  }

  it("orders the builds by the given platform order, whatever order they arrive in", () => {
    const merged = mergeVersionBuilds(
      [build("linux-x86_64"), build("windows-x86_64")],
      PLATFORMS,
    );

    expect(merged.builds.map((b) => b.platform)).toEqual([
      "windows-x86_64",
      "linux-x86_64",
    ]);
  });

  it("leads with the Windows build when both exist, so its notes are the version's", () => {
    const merged = mergeVersionBuilds(
      [build("linux-x86_64"), build("windows-x86_64")],
      PLATFORMS,
    );

    expect(merged.builds[0].notes).toBe("Notes of the windows-x86_64 build");
  });

  it("leads with the Linux build when it is the only one", () => {
    const merged = mergeVersionBuilds([build("linux-x86_64")], PLATFORMS);

    expect(merged.builds).toHaveLength(1);
    expect(merged.builds[0].notes).toBe("Notes of the linux-x86_64 build");
  });

  it("puts a platform outside the order after the known ones", () => {
    const merged = mergeVersionBuilds(
      [build("amiga-68k"), build("linux-x86_64")],
      PLATFORMS,
    );

    expect(merged.builds.map((b) => b.platform)).toEqual([
      "linux-x86_64",
      "amiga-68k",
    ]);
  });

  it("dates the version by the earliest release among its builds", () => {
    const merged = mergeVersionBuilds(
      [
        build("windows-x86_64", "2026-10-08T12:00:00.000Z"),
        build("linux-x86_64", "2026-10-06T12:00:00.000Z"),
      ],
      PLATFORMS,
    );

    expect(merged.releasedAt?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
  });

  it("ignores a build without a release date and has none when no build has one", () => {
    const dated = mergeVersionBuilds(
      [
        build("windows-x86_64"),
        build("linux-x86_64", "2026-10-06T12:00:00.000Z"),
      ],
      PLATFORMS,
    );
    const undated = mergeVersionBuilds([build("windows-x86_64")], PLATFORMS);

    expect(dated.releasedAt?.toISOString()).toBe("2026-10-06T12:00:00.000Z");
    expect(undated.releasedAt).toBeNull();
  });

  it("leaves the given list untouched", () => {
    const builds: [ReturnType<typeof build>, ...ReturnType<typeof build>[]] = [
      build("linux-x86_64"),
      build("windows-x86_64"),
    ];

    mergeVersionBuilds(builds, PLATFORMS);

    expect(builds.map((b) => b.platform)).toEqual([
      "linux-x86_64",
      "windows-x86_64",
    ]);
  });
});

describe("isDownloadUrlAllowed", () => {
  const hosts = ["downloads.createrington.com"];

  it("accepts an https URL on an allowed host", () => {
    expect(
      isDownloadUrlAllowed(
        "https://downloads.createrington.com/launcher/production/0.2.0/setup.exe",
        hosts,
      ),
    ).toBe(true);
  });

  it("compares the host without regard to case", () => {
    expect(
      isDownloadUrlAllowed("https://Downloads.Createrington.com/a.exe", hosts),
    ).toBe(true);
  });

  it.each([
    ["a foreign host", "https://evil.example.com/setup.exe"],
    [
      "an allowed host used as a subdomain of a foreign one",
      "https://downloads.createrington.com.evil.example.com/setup.exe",
    ],
    [
      "a foreign host with the allowed one in the path",
      "https://evil.example.com/downloads.createrington.com/setup.exe",
    ],
    [
      "an allowed host in the credentials part",
      "https://downloads.createrington.com@evil.example.com/setup.exe",
    ],
    [
      "credentials on an allowed host",
      "https://user:pass@downloads.createrington.com/setup.exe",
    ],
    ["plain http", "http://downloads.createrington.com/setup.exe"],
    ["a non-URL", "not a url"],
    ["a file URL", "file:///etc/passwd"],
  ])("refuses %s", (_label, url) => {
    expect(isDownloadUrlAllowed(url, hosts)).toBe(false);
  });

  it("refuses everything when no host is configured", () => {
    expect(
      isDownloadUrlAllowed("https://downloads.createrington.com/a.exe", []),
    ).toBe(false);
  });
});
