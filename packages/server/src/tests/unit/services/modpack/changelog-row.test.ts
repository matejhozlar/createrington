import { describe, it, expect, vi, afterEach } from "vitest";
import { loadImage } from "@napi-rs/canvas";
import {
  CHANGELOG_ROW_HEIGHT,
  CHANGELOG_ROW_RETRY_MS,
  CHANGELOG_ROW_WIDTH,
  changelogRowDetail,
  changelogRowName,
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

  it("drops glyphs the row fonts lack", () => {
    expect(
      changelogRowDetail(
        entry({ label: "✨ Shiny-1.0 ✨", previousLabel: null }),
        "added",
      ),
    ).toBe("Shiny-1.0");
  });
});

describe("changelogRowName", () => {
  it("keeps names the row fonts can draw, accents included", () => {
    expect(changelogRowName(entry({ name: "Café Décor" }))).toBe("Café Décor");
  });

  it("drops symbols the fonts lack but keeps the rest of the name", () => {
    expect(changelogRowName(entry({ name: "Jade 🔍 Addons" }))).toBe(
      "Jade Addons",
    );
  });

  it("falls back to the CurseForge slug for letters the fonts cannot draw", () => {
    const url = "https://www.curseforge.com/minecraft/mc-mods/nihongo-mod";
    expect(changelogRowName(entry({ name: "日本語Mod", url }))).toBe(
      "nihongo-mod",
    );
    expect(changelogRowName(entry({ name: "Мод", url }))).toBe("nihongo-mod");
  });

  it("keeps the raw name when there is no slug to fall back to", () => {
    expect(changelogRowName(entry({ name: "Мод", url: null }))).toBe("Мод");
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

  it("requests the 64px CurseForge thumbnail without following redirects", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(null, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const row = await renderChangelogRow(
      entry({
        name: "Redirect Icon Mod",
        thumbnailUrl:
          "https://media.forgecdn.net/avatars/thumbnails/1/2/256/256/icon.png",
      }),
      "updated",
    );

    expect(row.complete).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://media.forgecdn.net/avatars/thumbnails/1/2/64/64/icon.png",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("keeps a row with a failed icon for CHANGELOG_ROW_RETRY_MS, then tries again", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const failing = entry({
      name: "Flaky Icon Mod",
      thumbnailUrl:
        "https://media.forgecdn.net/avatars/thumbnails/1/3/256/256/icon.png",
    });

    const first = await renderChangelogRow(failing, "updated");
    now.mockReturnValue(1_000_000 + CHANGELOG_ROW_RETRY_MS - 1);
    const second = await renderChangelogRow(failing, "updated");
    now.mockReturnValue(1_000_000 + CHANGELOG_ROW_RETRY_MS + 1);
    const third = await renderChangelogRow(failing, "updated");

    expect(first.complete).toBe(false);
    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it("refuses icons on another port and bodies over 1 MB", async () => {
    const fetchMock = vi.fn(
      async () => new Response(new Uint8Array(1024 * 1024 + 1)),
    );
    vi.stubGlobal("fetch", fetchMock);

    const ported = await renderChangelogRow(
      entry({
        name: "Ported Icon Mod",
        thumbnailUrl: "https://media.forgecdn.net:1337/avatars/icon.png",
      }),
      "added",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ported.complete).toBe(true);

    const huge = await renderChangelogRow(
      entry({
        name: "Huge Icon Mod",
        thumbnailUrl: "https://media.forgecdn.net/avatars/huge.png",
      }),
      "added",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(huge.complete).toBe(false);
  });

  it("runs at most six icon fetches at once", async () => {
    let active = 0;
    let peak = 0;
    const fetchMock = vi.fn(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all(
      Array.from({ length: 15 }, (_, i) =>
        renderChangelogRow(
          entry({
            name: `Burst Mod ${i}`,
            thumbnailUrl: `https://media.forgecdn.net/avatars/burst-${i}.png`,
          }),
          "added",
        ),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(peak).toBe(6);
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
