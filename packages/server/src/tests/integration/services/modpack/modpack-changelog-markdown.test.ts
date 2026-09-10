import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadImage } from "@napi-rs/canvas";
import { Q } from "@/db";
import config from "@/config";
import { NotFoundError } from "@/app/middleware/error-handler";
import { modpackService } from "@/services/modpack";
import {
  CHANGELOG_ROW_HEIGHT,
  CHANGELOG_ROW_WIDTH,
} from "@/services/modpack/changelog-row";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import type { ReleaseModInsert } from "@/db/queries/modpack/release/mod";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

const ctx = createWorkshopTestContext(994_000_000);
const PACK_PROJECT_ID = 994_500_000;
const ROWS = `${config.meta.links.website.replace(/\/+$/, "")}/api/modpacks/${PACK_PROJECT_ID}/changelog/rows`;

let releaseSeq = 0;

function fileRow(projectId: number, version: string): ReleaseModInsert {
  return {
    curseforgeProjectId: projectId,
    fileId:
      800_000 +
      (projectId % 100_000) * 1000 +
      Number(version.replace(/\D/g, "")),
    fileName: `vitest-mod-${projectId}-${version}.jar`,
    displayName: `Vitest Mod ${projectId} ${version}`,
    fileReleaseType: 1,
    fileDate: null,
    required: true,
  };
}

async function seedRelease(
  modpack: Modpack,
  version: string | null,
  rows: ReleaseModInsert[],
): Promise<ModpackRelease> {
  releaseSeq++;
  const release = await Q.modpack.release.createAndReturn({
    modpackId: modpack.id,
    curseforgeFileId: 980_000 + releaseSeq,
    serverPackFileId: null,
    version,
    displayName: `Vitest Pack ${version}`,
    minecraftVersion: "1.21.1",
    modLoader: "neoforge-21.1.172",
    modCount: rows.length,
    publishedAt: new Date("2030-01-01T00:00:00Z"),
  });
  await Q.modpack.release.mod.insertMany(release.id, rows);
  return release;
}

async function seedPack(): Promise<Modpack> {
  await Q.curseforge.project.create({
    id: PACK_PROJECT_ID,
    classId: 4471,
    slug: "vitest-changelog-pack",
    name: "Vitest Changelog Pack",
    websiteUrl:
      "https://www.curseforge.com/minecraft/modpacks/vitest-changelog-pack",
  });
  ctx.projectIds.push(PACK_PROJECT_ID);
  return seedModpack(ctx, {
    name: "Vitest Changelog Pack",
    curseforgeProjectId: PACK_PROJECT_ID,
  });
}

async function seedHistory() {
  const modpack = await seedPack();
  const [kept, laterAdded, earlyAdded] = await Promise.all(
    [0, 1, 2].map((i) =>
      seedProject(ctx, `Changelog Mod ${i}`, {
        thumbnailUrl: `https://media.forgecdn.net/avatars/thumbnails/1/${i}/256/256/icon.png`,
        websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/changelog-mod-${i}`,
      }),
    ),
  );
  const first = await seedRelease(modpack, "1.0.0", [fileRow(kept, "1.0.0")]);
  const middle = await seedRelease(modpack, "1.1.0", [
    fileRow(kept, "1.0.0"),
    fileRow(earlyAdded, "1.0.0"),
  ]);
  const newest = await seedRelease(modpack, "1.2.0", [
    fileRow(kept, "1.2.0"),
    fileRow(earlyAdded, "1.0.0"),
    fileRow(laterAdded, "1.0.0"),
  ]);
  return { kept, laterAdded, earlyAdded, first, middle, newest };
}

function changelog(installedVersion?: string) {
  return modpackService.getChangelogMarkdown({
    curseforgeProjectId: PACK_PROJECT_ID,
    installedVersion,
  });
}

function row(releaseFileId: number, entryProjectId: number) {
  return modpackService.getChangelogRow({
    curseforgeProjectId: PACK_PROJECT_ID,
    releaseFileId,
    entryProjectId,
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 404 })),
  );
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await cleanupWorkshopTestContext(ctx);
});

describe("modpackService.getChangelogMarkdown", () => {
  it("renders the newest release against the one before it, one row image per change", async () => {
    const { kept, laterAdded, newest } = await seedHistory();

    const markdown = await changelog();

    expect(markdown.startsWith("## What's new in 1.2.0\n")).toBe(true);
    expect(markdown).toContain("1 Jan 2030 · since 1.1.0");
    expect(markdown).toContain(
      `### Added (1)\n[![](${ROWS}/${newest.curseforgeFileId}/${laterAdded}.png)](https://www.curseforge.com/minecraft/mc-mods/changelog-mod-1)`,
    );
    expect(markdown).toContain(
      `### Updated (1)\n[![](${ROWS}/${newest.curseforgeFileId}/${kept}.png)](https://www.curseforge.com/minecraft/mc-mods/changelog-mod-0)`,
    );
    expect(markdown).not.toContain("Your version");
  });

  it("appends an older installed release under an outdated label", async () => {
    const { earlyAdded, middle } = await seedHistory();

    const markdown = await changelog("1.1.0");

    const [newest, installed] = markdown.split("\n---\n");
    expect(newest).toContain("## What's new in 1.2.0");
    expect(newest).toContain("You're on 1.1.0. Update the pack");
    expect(installed).toContain("## Your version: 1.1.0");
    expect(installed).toContain("Outdated · 1 Jan 2030 · since 1.0.0");
    expect(installed).toContain(
      `${ROWS}/${middle.curseforgeFileId}/${earlyAdded}.png`,
    );
  });

  it("renders the newest release only when the player is current or the version is unknown", async () => {
    await seedHistory();

    for (const version of ["1.2.0", "0.9.0", undefined]) {
      const markdown = await changelog(version);
      expect(markdown).toContain("## What's new in 1.2.0");
      expect(markdown).not.toContain("Your version");
      expect(markdown).not.toContain("You're on");
    }
  });

  it("marks the first recorded release as having nothing to compare against", async () => {
    const modpack = await seedPack();
    const project = await seedProject(ctx);
    await seedRelease(modpack, "1.0.0", [fileRow(project, "1.0.0")]);

    const markdown = await changelog("1.0.0");

    expect(markdown).toContain("first recorded release");
    expect(markdown).not.toContain("### Added");
  });

  it("throws NotFoundError for an unknown project or a pack without releases", async () => {
    await expect(changelog()).rejects.toBeInstanceOf(NotFoundError);

    await seedPack();

    await expect(changelog()).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("modpackService.getChangelogRow", () => {
  it("renders a row for an entry the release changed", async () => {
    const { kept, newest } = await seedHistory();

    const image = await row(newest.curseforgeFileId, kept);

    expect(image.complete).toBe(false);
    const decoded = await loadImage(image.png);
    expect([decoded.width, decoded.height]).toEqual([
      CHANGELOG_ROW_WIDTH,
      CHANGELOG_ROW_HEIGHT,
    ]);
    expect(fetch).toHaveBeenCalledWith(
      "https://media.forgecdn.net/avatars/thumbnails/1/0/64/64/icon.png",
      expect.anything(),
    );
  });

  it("throws NotFoundError for an unchanged entry, an unknown release or an unknown pack", async () => {
    const { earlyAdded, newest, first } = await seedHistory();

    await expect(
      row(newest.curseforgeFileId, earlyAdded),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      row(first.curseforgeFileId - 500, earlyAdded),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      modpackService.getChangelogRow({
        curseforgeProjectId: PACK_PROJECT_ID + 1,
        releaseFileId: newest.curseforgeFileId,
        entryProjectId: earlyAdded,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
