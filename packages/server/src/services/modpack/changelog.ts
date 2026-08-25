import { Q, db } from "@/db";
import { escapeLike } from "@/db/utils";
import { ConstraintViolationError } from "@/db/utils/errors";
import { getService, Services } from "@/services";
import { DiscordMessageService } from "@/services/discord/message/message.service";
import { FeatureFlags, featureFlagService } from "@/services/feature-flag";
import { Discord } from "@/discord/constants";
import {
  buildComponentsMessage,
  validateComponentsV2,
} from "@/discord/components";
import {
  ModpackChangelogComponentPresets,
  type ChangelogEntry,
  type ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";
import {
  componentsDataSchema,
  type ComponentsData,
} from "@createrington/shared/api/embed";
import { CURSEFORGE_CLASSES } from "@createrington/shared/workshop";
import type {
  Modpack,
  ModpackRelease,
  ModpackReleaseAnnouncement,
} from "@createrington/shared/db";
import type { ReleaseModRow } from "@/db/queries/modpack/release/mod";
import type { ModpackReleaseDiff, ModpackReleaseDiffEntry } from "./index";

export const CHANGELOG_PRESET_CATEGORY = "Changelogs";
const PRESET_AUTHOR = "system";
const PRESET_NAME_MAX = 100;

const CLASS_PATHS: Record<number, string> = {
  [CURSEFORGE_CLASSES.mods]: "mc-mods",
  [CURSEFORGE_CLASSES.modpacks]: "modpacks",
  [CURSEFORGE_CLASSES.resourcePacks]: "texture-packs",
  [CURSEFORGE_CLASSES.shaders]: "shaders",
  [CURSEFORGE_CLASSES.dataPacks]: "data-packs",
};

const LOADER_NAMES: Record<string, string> = {
  forge: "Forge",
  neoforge: "NeoForge",
  fabric: "Fabric",
  quilt: "Quilt",
};

const inFlight = new Set<number>();

export interface AnnounceReleaseOptions {
  modpack: Modpack;
  releaseId: number;
  loadDiff: () => Promise<ModpackReleaseDiff>;
  /** Begin a new announcement when the release has none; off, only an unfinished one is resumed */
  start: boolean;
}

/**
 * Post a release's changelog to the changelog channel as Components V2
 * messages, or finish one that stopped partway. Every message part is saved
 * as an embed builder preset before it is sent and linked to its message
 * after, so admins can edit and re-push it from the builder; an edited
 * preset is what a resumed part sends. Parts are rows keyed by release and
 * part number, which is what makes a release announce once: a part without a
 * message id is the only thing ever (re)sent. No-op while the
 * modpack_changelog feature flag is off, and a release that had no parts
 * created by then is never announced later.
 */
export async function announceReleaseChangelog(
  options: AnnounceReleaseOptions,
): Promise<void> {
  if (inFlight.has(options.releaseId)) return;
  inFlight.add(options.releaseId);
  try {
    await run(options);
  } finally {
    inFlight.delete(options.releaseId);
  }
}

async function run({
  modpack,
  releaseId,
  loadDiff,
  start,
}: AnnounceReleaseOptions): Promise<void> {
  const existing = await Q.modpack.release.announcement.findAll(
    { releaseId },
    { orderBy: "part", orderDirection: "asc" },
  );
  if (existing.length === 0 && !start) return;
  if (existing.length > 0 && existing.every((row) => row.messageId !== null)) {
    return;
  }
  if (!(await featureFlagService.isEnabled(FeatureFlags.modpackChangelog))) {
    return;
  }

  const diff = await loadDiff();
  const parts = ModpackChangelogComponentPresets.release(
    await toChangelogInput(modpack, diff),
  );
  const rows =
    existing.length > 0 ? existing : await createParts(diff.release, parts);
  if (rows === null) return;

  const client = await getService(Services.DISCORD_MAIN_BOT);
  const messages = DiscordMessageService.getInstance(client);
  const label = releaseLabel(diff.release);
  let sent = 0;
  for (const row of rows) {
    if (row.messageId !== null) continue;
    const data = await payloadFor(row, parts);
    if (data === null) {
      logger.warn(
        `Changelog ${label} part ${row.part}/${row.partCount} has nothing to send, stopping`,
      );
      break;
    }
    const built = buildComponentsMessage(data);
    const result = await messages.send({
      channelId: row.channelId,
      components: built.components,
      flags: built.flags,
    });
    if (!result.success || !result.messageId) {
      logger.warn(
        `Changelog ${label} part ${row.part}/${row.partCount} failed to send, the next reconcile retries: ${result.error ?? "unknown error"}`,
      );
      break;
    }
    await Q.modpack.release.announcement.updateAll(
      { messageId: result.messageId, sentAt: new Date() },
      { id: row.id },
    );
    if (row.presetId !== null) {
      await Q.discord.embed.preset.message.create({
        presetId: row.presetId,
        channelId: row.channelId,
        messageId: result.messageId,
      });
    }
    sent++;
  }
  logger.info(
    `Posted changelog ${label} for modpack #${modpack.id}: ${sent} of ${rows.length} parts sent this run`,
  );
}

async function createParts(
  release: ModpackRelease,
  parts: ComponentsData[],
): Promise<ModpackReleaseAnnouncement[] | null> {
  const channelId = Discord.Channels.railsNSails.CHANGELOG;
  const categoryId = await ensureCategory();
  const names = await presetNames(release, parts.length);
  try {
    return await db.inTransaction(async (tx) => {
      const rows: ModpackReleaseAnnouncement[] = [];
      for (const [index, part] of parts.entries()) {
        const preset = await tx.discord.embed.preset.createAndReturn({
          name: names[index],
          kind: "components",
          data: part,
          createdBy: PRESET_AUTHOR,
          categoryId,
        });
        rows.push(
          await tx.modpack.release.announcement.createAndReturn({
            releaseId: release.id,
            part: index + 1,
            partCount: parts.length,
            presetId: preset.id,
            channelId,
          }),
        );
      }
      return rows;
    });
  } catch (error) {
    if (error instanceof ConstraintViolationError) return null;
    throw error;
  }
}

async function ensureCategory(): Promise<number> {
  const existing = await Q.discord.embed.preset.category.find({
    name: CHANGELOG_PRESET_CATEGORY,
  });
  if (existing) return existing.id;
  const [last] = await Q.discord.embed.preset.category.findAll(
    {},
    { orderBy: "sortOrder", orderDirection: "desc", limit: 1 },
  );
  try {
    const created = await Q.discord.embed.preset.category.createAndReturn({
      name: CHANGELOG_PRESET_CATEGORY,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    });
    return created.id;
  } catch (error) {
    if (error instanceof ConstraintViolationError) {
      const raced = await Q.discord.embed.preset.category.find({
        name: CHANGELOG_PRESET_CATEGORY,
      });
      if (raced) return raced.id;
    }
    throw error;
  }
}

function clipName(name: string): string {
  return name.length > PRESET_NAME_MAX
    ? `${name.slice(0, PRESET_NAME_MAX - 1)}…`
    : name;
}

async function presetNames(
  release: ModpackRelease,
  count: number,
): Promise<string[]> {
  const base = `Changelog ${releaseLabel(release)}`;
  const taken = new Set(
    (
      await Q.discord.embed.preset.findAll({
        name: { $ilike: `${escapeLike(base)}%` },
      })
    ).map((preset) => preset.name),
  );
  return Array.from({ length: count }, (_, index) => {
    const suffix = count > 1 ? ` (${index + 1}/${count})` : "";
    const candidates = [
      `${base}${suffix}`,
      `${base} #${release.id}${suffix}`,
      `${base} #${release.id}-${Date.now()}${suffix}`,
    ].map(clipName);
    return candidates.find((name) => !taken.has(name)) ?? candidates[2];
  });
}

async function payloadFor(
  row: ModpackReleaseAnnouncement,
  parts: ComponentsData[],
): Promise<ComponentsData | null> {
  const rendered = parts[row.part - 1] ?? null;
  if (row.presetId === null) return rendered;
  const preset = await Q.discord.embed.preset.find({ id: row.presetId });
  if (!preset) return rendered;
  const parsed = componentsDataSchema.safeParse(preset.data);
  if (parsed.success && validateComponentsV2(parsed.data) === null) {
    return parsed.data;
  }
  logger.warn(
    `Changelog preset #${preset.id} is not a valid Components V2 message, sending the generated part instead`,
  );
  return rendered;
}

function releaseLabel(release: ModpackRelease): string {
  return (
    release.version ?? release.displayName ?? `file ${release.curseforgeFileId}`
  );
}

function loaderLabel(loader: string | null): string | null {
  if (!loader) return null;
  const [name, ...rest] = loader.split("-");
  const pretty = LOADER_NAMES[name.toLowerCase()] ?? name;
  return rest.length > 0 ? `${pretty} ${rest.join("-")}` : pretty;
}

function fileLabel(row: ReleaseModRow): string {
  const raw = row.displayName ?? row.fileName ?? `File #${row.fileId}`;
  return raw.replace(/\.jar$/i, "");
}

function projectUrl(row: ReleaseModRow): string | null {
  if (row.websiteUrl) return row.websiteUrl;
  const path = CLASS_PATHS[row.classId];
  return path
    ? `https://www.curseforge.com/minecraft/${path}/${row.projectSlug}`
    : null;
}

function stateLabel(required: boolean): string {
  return required ? "Enabled" : "Disabled";
}

function toEntry(entry: ModpackReleaseDiffEntry): ChangelogEntry {
  const previous = entry.previousFile;
  const flagOnly =
    previous !== null &&
    previous.fileId === entry.fileId &&
    previous.required !== entry.required;
  return {
    name: entry.projectName,
    url: projectUrl(entry),
    thumbnailUrl: entry.thumbnailUrl,
    classId: entry.classId,
    disabled: !entry.required,
    label: flagOnly ? stateLabel(entry.required) : fileLabel(entry),
    previousLabel:
      previous === null
        ? null
        : flagOnly
          ? stateLabel(previous.required)
          : fileLabel(previous),
  };
}

async function toChangelogInput(
  modpack: Modpack,
  diff: ModpackReleaseDiff,
): Promise<ChangelogInput> {
  const { release } = diff;
  const project = modpack.curseforgeProjectId
    ? await Q.curseforge.project.find({ id: modpack.curseforgeProjectId })
    : null;
  return {
    release: {
      title:
        release.displayName ??
        [modpack.name, release.version]
          .filter((part): part is string => part !== null)
          .join(" "),
      minecraftVersion: release.minecraftVersion,
      modLoader: loaderLabel(release.modLoader),
      modCount: release.modCount,
      publishedAt: release.publishedAt,
      downloadUrl: project?.websiteUrl
        ? `${project.websiteUrl}/files/${release.curseforgeFileId}`
        : null,
    },
    previousVersion: diff.previous ? releaseLabel(diff.previous) : null,
    added: diff.added.map(toEntry),
    updated: diff.updated.map(toEntry),
    removed: diff.removed.map(toEntry),
    unchanged: diff.unchanged,
  };
}
