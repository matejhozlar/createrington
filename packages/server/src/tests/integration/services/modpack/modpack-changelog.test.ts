import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { ComponentType } from "discord.js";

const sendMock = vi.hoisted(() =>
  vi.fn(async (_options: unknown) => ({
    success: true as boolean,
    messageId: "message-1" as string | undefined,
    error: undefined as string | undefined,
  })),
);

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  return { ...actual, getService: vi.fn(async () => ({})) };
});

vi.mock("@/services/discord/message/message.service", () => ({
  DiscordMessageService: { getInstance: () => ({ send: sendMock }) },
}));

import { Q } from "@/db";
import { modpackService } from "@/services/modpack";
import {
  announceReleaseChangelog,
  CHANGELOG_PRESET_CATEGORY,
} from "@/services/modpack/changelog";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import { Discord } from "@/discord/constants";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import type { ReleaseModInsert } from "@/db/queries/modpack/release/mod";
import {
  createWorkshopTestContext,
  cleanupWorkshopTestContext,
  seedModpack,
  seedProject,
} from "@/tests/helpers/workshop";

const ctx = createWorkshopTestContext(993_000_000);
const PACK_PROJECT_ID = 993_500_000;
const CHANNEL_ID = Discord.Channels.railsNSails.CHANGELOG;

let flagBefore: boolean | null = null;
let categoryExisted = false;
let releaseSeq = 0;
const createdPresetIds: number[] = [];

interface SentMessage {
  channelId: string;
  components: Array<{ toJSON(): unknown }>;
}

function sentMessages(): Array<{ channelId: string; texts: string[] }> {
  return sendMock.mock.calls.map(([options]) => {
    const { channelId, components } = options as SentMessage;
    const [root] = components.map((c) => c.toJSON()) as Array<{
      type: number;
      components: Array<{
        type: number;
        content?: string;
        components?: Array<{ content: string }>;
      }>;
    }>;
    if (root.type !== ComponentType.Container) {
      throw new Error("expected a container");
    }
    const texts = root.components.flatMap((child) => {
      if (child.type === ComponentType.TextDisplay)
        return [child.content ?? ""];
      if (child.type === ComponentType.Section) {
        return (child.components ?? []).map((t) => t.content);
      }
      return [];
    });
    return { channelId, texts };
  });
}

function fileRow(projectId: number, version: string): ReleaseModInsert {
  return {
    curseforgeProjectId: projectId,
    fileId:
      700_000 +
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
  version: string,
  rows: ReleaseModInsert[],
  overrides: Partial<ModpackRelease> = {},
): Promise<ModpackRelease> {
  releaseSeq++;
  const release = await Q.modpack.release.createAndReturn({
    modpackId: modpack.id,
    curseforgeFileId: 990_000 + releaseSeq,
    serverPackFileId: 995_000 + releaseSeq,
    version,
    displayName: `Vitest Pack ${version}`,
    minecraftVersion: "1.21.1",
    modLoader: "neoforge-21.1.172",
    modCount: rows.length,
    publishedAt: new Date("2030-01-01T00:00:00Z"),
    ...overrides,
  });
  await Q.modpack.release.mod.insertMany(release.id, rows);
  return release;
}

async function seedPack(): Promise<Modpack> {
  await Q.curseforge.project.create({
    id: PACK_PROJECT_ID,
    classId: 4471,
    slug: "vitest-pack",
    name: "Vitest Pack",
    websiteUrl: "https://www.curseforge.com/minecraft/modpacks/vitest-pack",
  });
  ctx.projectIds.push(PACK_PROJECT_ID);
  return seedModpack(ctx, {
    name: "Vitest Pack",
    curseforgeProjectId: PACK_PROJECT_ID,
    shipsServerPack: true,
  });
}

async function seedProjects(count: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(
      await seedProject(ctx, undefined, {
        thumbnailUrl: `https://media.forgecdn.net/avatars/vitest-${i}.png`,
        websiteUrl: `https://www.curseforge.com/minecraft/mc-mods/vitest-${i}`,
      }),
    );
  }
  return ids;
}

function announce(modpack: Modpack, release: ModpackRelease, start: boolean) {
  return announceReleaseChangelog({
    modpack,
    releaseId: release.id,
    start,
    loadDiff: () => modpackService.getReleaseDiff(release.id),
  });
}

async function trackPresets(): Promise<void> {
  if (ctx.modpackIds.length === 0) return;
  const releases = await Q.modpack.release.findAll({
    modpackId: { $in: ctx.modpackIds },
  });
  const rows = await Q.modpack.release.announcement.findAll({
    releaseId: { $in: releases.map((r) => r.id) },
  });
  for (const row of rows) {
    if (row.presetId !== null && !createdPresetIds.includes(row.presetId)) {
      createdPresetIds.push(row.presetId);
    }
  }
}

beforeAll(async () => {
  const flag = await Q.feature.flag.find({
    name: FeatureFlags.modpackChangelog,
  });
  flagBefore = flag?.enabled ?? null;
  categoryExisted =
    (await Q.discord.embed.preset.category.find({
      name: CHANGELOG_PRESET_CATEGORY,
    })) !== null;
  await featureFlagService.setEnabled(FeatureFlags.modpackChangelog, true);
});

beforeEach(() => {
  sendMock.mockReset();
  let seq = 0;
  sendMock.mockImplementation(async () => ({
    success: true,
    messageId: `message-${++seq}`,
    error: undefined,
  }));
});

afterEach(async () => {
  await trackPresets();
  await cleanupWorkshopTestContext(ctx);
  if (createdPresetIds.length > 0) {
    await Q.discord.embed.preset.deleteAll({ id: { $in: createdPresetIds } });
    createdPresetIds.length = 0;
  }
  vi.clearAllMocks();
});

afterAll(async () => {
  if (flagBefore === null) {
    await Q.feature.flag.deleteAll({ name: FeatureFlags.modpackChangelog });
  } else {
    await featureFlagService.setEnabled(
      FeatureFlags.modpackChangelog,
      flagBefore,
    );
  }
  if (!categoryExisted) {
    await Q.discord.embed.preset.category.deleteAll({
      name: CHANGELOG_PRESET_CATEGORY,
    });
  }
});

describe("announceReleaseChangelog", () => {
  it("posts a release once, saved as a linked preset in the Changelogs category", async () => {
    const modpack = await seedPack();
    const [kept, added] = await seedProjects(2);
    await seedRelease(modpack, "1.0.0", [fileRow(kept, "1.0.0")]);
    const release = await seedRelease(modpack, "1.1.0", [
      fileRow(kept, "1.1.0"),
      fileRow(added, "1.0.0"),
    ]);

    await announce(modpack, release, true);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [message] = sentMessages();
    expect(message.channelId).toBe(CHANNEL_ID);
    expect(message.texts[0]).toContain("## 📦 Vitest Pack 1.1.0");
    expect(message.texts[0]).toContain("NeoForge 21.1.172");
    expect(message.texts[0]).toContain("Changes since 1.0.0");
    expect(message.texts).toContain("### ✨ Added (1)");
    expect(message.texts).toContain("### ⬆️ Updated (1)");
    expect(message.texts.join("\n")).toContain(
      "`Vitest Mod " + kept + " 1.0.0` → `Vitest Mod " + kept + " 1.1.0`",
    );

    const rows = await Q.modpack.release.announcement.findAll({
      releaseId: release.id,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      part: 1,
      partCount: 1,
      channelId: CHANNEL_ID,
      messageId: "message-1",
    });
    expect(rows[0].sentAt).not.toBeNull();

    const preset = await Q.discord.embed.preset.get({ id: rows[0].presetId! });
    expect(preset).toMatchObject({
      name: "Changelog 1.1.0",
      kind: "components",
      createdBy: "system",
    });
    const category = await Q.discord.embed.preset.category.get({
      id: preset.categoryId!,
    });
    expect(category.name).toBe(CHANGELOG_PRESET_CATEGORY);
    expect(
      await Q.discord.embed.preset.message.findAll({ presetId: preset.id }),
    ).toMatchObject([{ channelId: CHANNEL_ID, messageId: "message-1" }]);

    const [listed] = await modpackService.listReleases(modpack.id);
    expect(listed.announcement).toEqual({
      parts: 1,
      sent: 1,
      presets: [{ id: preset.id, name: "Changelog 1.1.0" }],
    });

    await announce(modpack, release, true);
    await announce(modpack, release, false);
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("splits a long diff into parts and resumes only the unsent ones", async () => {
    const modpack = await seedPack();
    const projects = await seedProjects(30);
    await seedRelease(modpack, "2.0.0", []);
    const release = await seedRelease(
      modpack,
      "2.1.0",
      projects.map((id) => fileRow(id, "1.0.0")),
    );

    sendMock
      .mockImplementationOnce(async () => ({
        success: true,
        messageId: "first",
        error: undefined,
      }))
      .mockImplementationOnce(async () => ({
        success: false,
        messageId: undefined,
        error: "rate limited",
      }));

    await announce(modpack, release, true);

    const rows = await Q.modpack.release.announcement.findAll(
      { releaseId: release.id },
      { orderBy: "part", orderDirection: "asc" },
    );
    expect(rows.length).toBeGreaterThan(2);
    expect(rows[0].messageId).toBe("first");
    expect(rows.slice(1).every((row) => row.messageId === null)).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.partCount)).toEqual(
      rows.map(() => rows.length),
    );

    const presets = await Q.discord.embed.preset.findAll({
      id: { $in: rows.map((row) => row.presetId!) },
    });
    expect(presets.map((p) => p.name).sort()).toEqual(
      rows.map((row) => `Changelog 2.1.0 (${row.part}/${rows.length})`).sort(),
    );

    sendMock.mockClear();
    await announce(modpack, release, false);

    expect(sendMock).toHaveBeenCalledTimes(rows.length - 1);
    const after = await Q.modpack.release.announcement.findAll(
      { releaseId: release.id },
      { orderBy: "part", orderDirection: "asc" },
    );
    expect(after.every((row) => row.messageId !== null)).toBe(true);
    expect(new Set(after.map((row) => row.messageId)).size).toBe(after.length);
    expect(
      await Q.discord.embed.preset.message.count({
        presetId: { $in: rows.map((row) => row.presetId!) },
      }),
    ).toBe(rows.length);

    const messages = sentMessages();
    expect(messages[0].texts[0]).toContain(`Part 2 of ${rows.length}`);
    expect(messages.at(-1)!.texts[0]).toContain(
      `Part ${rows.length} of ${rows.length}`,
    );
  });

  it("sends an admin-edited preset instead of the generated part", async () => {
    const modpack = await seedPack();
    const [project] = await seedProjects(1);
    await seedRelease(modpack, "3.0.0", []);
    const release = await seedRelease(modpack, "3.1.0", [
      fileRow(project, "1.0.0"),
    ]);
    sendMock.mockImplementationOnce(async () => ({
      success: false,
      messageId: undefined,
      error: "boom",
    }));
    await announce(modpack, release, true);
    const [row] = await Q.modpack.release.announcement.findAll({
      releaseId: release.id,
    });
    expect(row.messageId).toBeNull();

    await Q.discord.embed.preset.update(
      { id: row.presetId! },
      {
        data: {
          components: [
            {
              type: "container",
              spoiler: false,
              components: [{ type: "text", content: "Edited by an admin" }],
            },
          ],
        },
      },
    );

    sendMock.mockClear();
    await announce(modpack, release, false);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sentMessages()[0].texts).toEqual(["Edited by an admin"]);
  });

  it("never starts an announcement while only resuming", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "4.0.0", []);
    const release = await seedRelease(modpack, "4.1.0", []);

    await announce(modpack, release, false);

    expect(sendMock).not.toHaveBeenCalled();
    expect(
      await Q.modpack.release.announcement.count({ releaseId: release.id }),
    ).toBe(0);
  });

  it("does nothing while the feature flag is off", async () => {
    const modpack = await seedPack();
    await seedRelease(modpack, "5.0.0", []);
    const release = await seedRelease(modpack, "5.1.0", []);
    await featureFlagService.setEnabled(FeatureFlags.modpackChangelog, false);
    try {
      await announce(modpack, release, true);
    } finally {
      await featureFlagService.setEnabled(FeatureFlags.modpackChangelog, true);
    }

    expect(sendMock).not.toHaveBeenCalled();
    expect(
      await Q.modpack.release.announcement.count({ releaseId: release.id }),
    ).toBe(0);
  });

  it("skips the first recorded release of a modpack", async () => {
    const modpack = await seedPack();
    const [project] = await seedProjects(1);
    const release = await seedRelease(modpack, "6.0.0", [
      fileRow(project, "1.0.0"),
    ]);

    await announce(modpack, release, true);

    expect(sendMock).not.toHaveBeenCalled();
    expect(
      await Q.modpack.release.announcement.count({ releaseId: release.id }),
    ).toBe(0);
  });

  it("keeps the part suffix when the release label is too long for a preset name", async () => {
    const modpack = await seedPack();
    const projects = await seedProjects(30);
    await seedRelease(modpack, "7.0.0", []);
    const version = `7.1.0-${"nightly".repeat(20)}`;
    const release = await seedRelease(
      modpack,
      version,
      projects.map((id) => fileRow(id, "1.0.0")),
    );

    await announce(modpack, release, true);

    const rows = await Q.modpack.release.announcement.findAll(
      { releaseId: release.id },
      { orderBy: "part", orderDirection: "asc" },
    );
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.every((row) => row.messageId !== null)).toBe(true);
    const presets = await Q.discord.embed.preset.findAll({
      id: { $in: rows.map((row) => row.presetId!) },
    });
    expect(presets).toHaveLength(rows.length);
    const names = presets.map((preset) => preset.name);
    expect(new Set(names).size).toBe(rows.length);
    for (const row of rows) {
      const preset = presets.find((p) => p.id === row.presetId)!;
      expect(preset.name.length).toBeLessThanOrEqual(100);
      expect(preset.name.endsWith(` (${row.part}/${rows.length})`)).toBe(true);
      expect(preset.name.startsWith("Changelog 7.1.0-nightly")).toBe(true);
    }
  });

  it("drops malformed cached URLs instead of failing the part", async () => {
    const modpack = await seedPack();
    const broken = await seedProject(ctx, "Broken Links", {
      thumbnailUrl: "not a url",
      websiteUrl: "javascript:alert(1)",
    });
    await seedRelease(modpack, "8.0.0", []);
    const release = await seedRelease(modpack, "8.1.0", [
      fileRow(broken, "1.0.0"),
    ]);

    await announce(modpack, release, true);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [message] = sentMessages();
    const body = message.texts.find((t) => t.includes("Broken Links"));
    expect(body).toBeDefined();
    expect(body).toMatch(
      /^\*\*\[Broken Links\]\(https:\/\/www\.curseforge\.com\/minecraft\/mc-mods\//,
    );
    expect(body).not.toContain("javascript:");
    expect(
      (
        await Q.modpack.release.announcement.findAll({ releaseId: release.id })
      ).map((row) => row.messageId),
    ).toEqual(["message-1"]);
  });
});
