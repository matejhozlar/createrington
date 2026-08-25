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
  httpUrlSchema,
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
const PRESET_NAME_SEARCH_PREFIX = 40;

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
 * modpack_changelog feature flag is off, for the first recorded release of a
 * modpack (nothing to diff against), and for a release that had no parts
 * created by the time either applied.
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
  const label = releaseLabel(diff.release);
  if (existing.length === 0 && diff.previous === null) {
    logger.info(
      `Changelog ${label} is the first recorded release of modpack #${modpack.id}, nothing to compare against, not announced`,
    );
    return;
  }

  const parts = ModpackChangelogComponentPresets.release(
    await toChangelogInput(modpack, diff),
  );
  if (existing.length > 0 && parts.length !== existing[0].partCount) {
    logger.warn(
      `Changelog ${label} re-rendered into ${parts.length} parts but the announcement has ${existing[0].partCount}, stored presets are sent as saved`,
    );
  }
  const rows =
    existing.length > 0 ? existing : await createParts(diff.release, parts);
  if (rows === null) return;

  const client = await getService(Services.DISCORD_MAIN_BOT);
  const messages = DiscordMessageService.getInstance(client);
  let sent = 0;
  for (const row of rows) {
    if (row.messageId !== null) continue;
    const partLabel = `Changelog ${label} part ${row.part}/${row.partCount}`;
    const data = await payloadFor(row, parts);
    if (data === null) {
      logger.warn(`${partLabel} has nothing to send, stopping`);
      break;
    }
    let built: ReturnType<typeof buildComponentsMessage>;
    try {
      built = buildComponentsMessage(data);
    } catch (error) {
      logger.warn(`${partLabel} could not be built, stopping:`, error);
      break;
    }
    const result = await messages.send({
      channelId: row.channelId,
      components: built.components,
      flags: built.flags,
    });
    const messageId = result.messageId;
    if (!result.success || !messageId) {
      logger.warn(
        `${partLabel} failed to send, the next reconcile retries: ${result.error ?? "unknown error"}`,
      );
      break;
    }
    try {
      await db.inTransaction(async (tx) => {
        await tx.modpack.release.announcement.updateAll(
          { messageId, sentAt: new Date() },
          { id: row.id },
        );
        if (row.presetId !== null) {
          await tx.discord.embed.preset.message.create({
            presetId: row.presetId,
            channelId: row.channelId,
            messageId,
          });
        }
      });
    } catch (error) {
      logger.warn(
        `${partLabel} was posted as message ${messageId} but recording it failed, the next reconcile posts it again:`,
        error,
      );
      break;
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
    if (!(error instanceof ConstraintViolationError)) throw error;
    const label = releaseLabel(release);
    const claimed = await Q.modpack.release.announcement.count({
      releaseId: release.id,
    });
    if (claimed > 0) {
      logger.info(`Changelog ${label} was claimed by a concurrent run`);
    } else {
      logger.warn(
        `Changelog ${label} could not be saved as presets and was not announced: ${error.message}`,
      );
    }
    return null;
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

function presetName(stem: string, suffix: string): string {
  const max = PRESET_NAME_MAX - suffix.length;
  const clipped = stem.length > max ? `${stem.slice(0, max - 1)}…` : stem;
  return `${clipped}${suffix}`;
}

async function presetNames(
  release: ModpackRelease,
  count: number,
): Promise<string[]> {
  const base = `Changelog ${releaseLabel(release)}`;
  const taken = new Set(
    (
      await Q.discord.embed.preset.findAll({
        name: {
          $ilike: `${escapeLike(base.slice(0, PRESET_NAME_SEARCH_PREFIX))}%`,
        },
      })
    ).map((preset) => preset.name),
  );
  const stems = [
    base,
    `${base} #${release.id}`,
    `${base} #${release.id}-${Date.now()}`,
  ];
  return Array.from({ length: count }, (_, index) => {
    const suffix = count > 1 ? ` (${index + 1}/${count})` : "";
    const candidates = stems.map((stem) => presetName(stem, suffix));
    const name =
      candidates.find((candidate) => !taken.has(candidate)) ?? candidates[2];
    taken.add(name);
    return name;
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

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return httpUrlSchema.safeParse(value).success ? value : null;
}

function fileLabel(row: ReleaseModRow): string {
  const raw = row.displayName ?? row.fileName ?? `File #${row.fileId}`;
  return raw.replace(/\.jar$/i, "");
}

function projectUrl(row: ReleaseModRow): string | null {
  const cached = httpUrl(row.websiteUrl);
  if (cached) return cached;
  const path = CLASS_PATHS[row.classId];
  return path
    ? httpUrl(
        `https://www.curseforge.com/minecraft/${path}/${encodeURIComponent(row.projectSlug)}`,
      )
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
    thumbnailUrl: httpUrl(entry.thumbnailUrl),
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
  const packUrl = httpUrl(project?.websiteUrl);
  return {
    release: {
      title:
        release.displayName ??
        [modpack.name, release.version]
          .filter((part): part is string => part !== null)
          .join(" "),
      label: releaseLabel(release),
      titleImageUrl: httpUrl(modpack.titleImageUrl),
      minecraftVersion: release.minecraftVersion,
      modLoader: loaderLabel(release.modLoader),
      modCount: release.modCount,
      publishedAt: release.publishedAt,
      downloadUrl: packUrl
        ? httpUrl(`${packUrl}/files/${release.curseforgeFileId}`)
        : null,
    },
    previousVersion: diff.previous ? releaseLabel(diff.previous) : null,
    added: diff.added.map(toEntry),
    updated: diff.updated.map(toEntry),
    removed: diff.removed.map(toEntry),
    unchanged: diff.unchanged,
  };
}
