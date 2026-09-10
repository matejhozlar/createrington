import { describe, it, expect, vi, afterEach } from "vitest";
import { loadImage } from "@napi-rs/canvas";
import {
  CHANGELOG_ROW_HEIGHT,
  CHANGELOG_ROW_WIDTH,
  changelogRowDetail,
  renderChangelogRow,
  versionChange,
} from "@/services/modpack/changelog-row";
import type { ChangelogEntry } from "@/discord/components/presets/modpack-changelog";

function entry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    projectId: 1001,
    name: "Create",
    url: "https://www.curseforge.com/minecraft/mc-mods/create",
    thumbnailUrl: null,
    classId: 6,
    disabled: false,
    label: "create-1.21.1-6.0.6",
    previousLabel: "create-1.21.1-6.0.4",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("versionChange", () => {
  it.each([
    ["create-1.21.1-6.0.4", "create-1.21.1-6.0.6", "6.0.4 -> 6.0.6"],
    ["Jade 15.8.2+neoforge", "Jade 15.8.3+neoforge", "15.8.2 -> 15.8.3"],
    [
      "sophisticatedbackpacks-1.21.1-3.23.4.1.110",
      "sophisticatedbackpacks-1.21.1-3.23.5.1.112",
      "3.23.4.1.110 -> 3.23.5.1.112",
    ],
    ["mod-1.0-neoforge", "mod-1.1-neoforge", "1.0 -> 1.1"],
    ["mod-1.0", "mod-1.0-hotfix", "1.0 -> 1.0-hotfix"],
    ["Enabled", "Disabled", "Enabled -> Disabled"],
    ["15.8.2", "15.8.3", "15.8.2 -> 15.8.3"],
  ])("shortens %s to %s", (previous, current, expected) => {
    expect(versionChange(previous, current)).toBe(expected);
  });

  it("shows a relabeled file once", () => {
    expect(versionChange("mod-1.0", "mod-1.0")).toBe("mod-1.0");
  });

  it("keeps both labels when trimming would empty one side", () => {
    expect(versionChange("mod-", "mod-1.0")).toBe("mod- -> mod-1.0");
    expect(versionChange("+neoforge", "1.0+neoforge")).toBe(
      "+neoforge -> 1.0+neoforge",
    );
  });
});

describe("changelogRowDetail", () => {
  it("shows the version change for updated entries", () => {
    expect(changelogRowDetail(entry(), "updated")).toBe("6.0.4 -> 6.0.6");
  });

  it("shows the file label for added and removed entries", () => {
    expect(changelogRowDetail(entry(), "added")).toBe("create-1.21.1-6.0.6");
    expect(changelogRowDetail(entry(), "removed")).toBe("create-1.21.1-6.0.6");
  });

  it("leads with the project class and disabled tags", () => {
    expect(
      changelogRowDetail(
        entry({ classId: 12, disabled: true, previousLabel: null }),
        "added",
      ),
    ).toBe("Resource pack · disabled · create-1.21.1-6.0.6");
  });
});

describe("renderChangelogRow", () => {
  it("draws a row of the fixed size with a placeholder when there is no icon", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const row = await renderChangelogRow(
      entry({ name: "Placeholder Mod" }),
      "added",
    );

    expect(row.complete).toBe(true);
    const image = await loadImage(row.png);
    expect([image.width, image.height]).toEqual([
      CHANGELOG_ROW_WIDTH,
      CHANGELOG_ROW_HEIGHT,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never fetches icons from hosts other than the CurseForge CDN", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const row = await renderChangelogRow(
      entry({
        name: "Foreign Icon Mod",
        thumbnailUrl: "https://example.com/icon.png",
      }),
      "added",
    );

    expect(row.complete).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests the 64px CurseForge thumbnail and flags a failed fetch as incomplete", async () => {
    const fetchMock = vi.fn(
      async (_url: string) => new Response(null, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const failing = entry({
      name: "Flaky Icon Mod",
      thumbnailUrl:
        "https://media.forgecdn.net/avatars/thumbnails/1/2/256/256/icon.png",
    });

    const first = await renderChangelogRow(failing, "updated");
    const second = await renderChangelogRow(failing, "updated");

    expect(first.complete).toBe(false);
    expect(second.complete).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://media.forgecdn.net/avatars/thumbnails/1/2/64/64/icon.png",
    );
  });

  it("reuses a complete row and shares one render between concurrent requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cachedEntry = entry({ name: "Cached Mod" });

    const [a, b] = await Promise.all([
      renderChangelogRow(cachedEntry, "removed"),
      renderChangelogRow(cachedEntry, "removed"),
    ]);
    const c = await renderChangelogRow(cachedEntry, "removed");

    expect(a).toBe(b);
    expect(c).toBe(a);
  });
});
