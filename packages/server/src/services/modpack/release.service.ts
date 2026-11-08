import { Q } from "@/db";
import { NotFoundError } from "@/app/middleware/error-handler";
import type { Modpack, ModpackRelease } from "@createrington/shared/db";
import type { ReleaseModRow } from "@/db/queries/modpack/release/mod";
import type { ReleaseAnnouncementRow } from "@/db/queries/modpack/release/announcement";
import { CHANGELOG_GROUPS } from "@/discord/components/presets/modpack-changelog";
import {
  renderChangelogMarkdown,
  type ChangelogMarkdownSection,
} from "./changelog-markdown";
import { renderChangelogRow, type ChangelogRowImage } from "./changelog-row";
import {
  getReleaseChangelog,
  getReleaseDiff,
  type ModpackReleaseDiff,
} from "./release-changelog";
import { isOlderVersion } from "./version";
import config from "@/config";

export interface ModpackReleaseAnnouncementSummary {
  parts: number;
  sent: number;
  presets: Array<{ id: number; name: string }>;
}

export interface ModpackReleaseListItem extends ModpackRelease {
  announcement: ModpackReleaseAnnouncementSummary | null;
}

export interface ModpackVersionStatus {
  latest: string;
  installed: string | null;
  outdated: boolean;
}

/**
 * Recorded release history of a modpack: the admin release list and diffs,
 * and the public in-game surface (changelog Markdown and row images, update
 * notices) keyed by the CurseForge project a pack is published as. Reads
 * only frozen release rows, never CurseForge.
 */
export class ModpackReleaseService {
  /** Recorded releases of a modpack, newest first, each with the state of its changelog post. */
  async listReleases(modpackId: number): Promise<ModpackReleaseListItem[]> {
    const releases = await Q.modpack.release.findAll(
      { modpackId },
      { orderBy: "id", orderDirection: "desc" },
    );
    const rows = await Q.modpack.release.announcement.listForReleases(
      releases.map((release) => release.id),
    );
    const byRelease = new Map<number, ReleaseAnnouncementRow[]>();
    for (const row of rows) {
      const list = byRelease.get(row.releaseId) ?? [];
      list.push(row);
      byRelease.set(row.releaseId, list);
    }
    return releases.map((release) => {
      const parts = byRelease.get(release.id);
      return {
        ...release,
        announcement: parts
          ? {
              parts: parts.length,
              sent: parts.filter((part) => part.messageId !== null).length,
              presets: parts.flatMap((part) =>
                part.presetId !== null && part.presetName !== null
                  ? [{ id: part.presetId, name: part.presetName }]
                  : [],
              ),
            }
          : null,
      };
    });
  }

  /**
   * What a release changed against the one before it. Both sides are read from
   * frozen rows, so this keeps working after CurseForge archives the files.
   */
  async getReleaseDiff(releaseId: number): Promise<ModpackReleaseDiff> {
    return getReleaseDiff(releaseId);
  }

  /** Frozen membership of a recorded release, joined to cached project summaries. */
  async getReleaseMods(releaseId: number): Promise<ReleaseModRow[]> {
    const release = await Q.modpack.release.get({ id: releaseId });
    const rows = await Q.modpack.release.mod.listForReleases([release.id]);
    return rows.map(({ releaseId: _releaseId, ...row }) => row);
  }

  /** In-game changelog Markdown of a CurseForge-published pack's newest release, plus the installed one when it is an older recorded release; throws NotFoundError without a pack or release. */
  async getChangelogMarkdown(options: {
    curseforgeProjectId: number;
    installedVersion?: string;
  }): Promise<string> {
    const modpack = await this.getPublishedModpack(options.curseforgeProjectId);
    const [latest] = await Q.modpack.release.findAll(
      { modpackId: modpack.id },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    if (!latest) {
      throw new NotFoundError(`${modpack.name} has no recorded release yet`);
    }
    const { installedVersion } = options;
    const [installed] =
      installedVersion !== undefined && installedVersion !== latest.version
        ? await Q.modpack.release.findAll(
            { modpackId: modpack.id, version: installedVersion },
            { orderBy: "id", orderDirection: "desc", limit: 1 },
          )
        : [];
    const website = config.meta.links.website.replace(/\/+$/, "");
    const sectionOf = async (
      release: ModpackRelease,
    ): Promise<ChangelogMarkdownSection> => ({
      changelog: await getReleaseChangelog(modpack, release),
      rowImageBaseUrl: `${website}/api/modpacks/${options.curseforgeProjectId}/changelog/rows/${release.curseforgeFileId}`,
    });
    const [latestSection, installedSection] = await Promise.all([
      sectionOf(latest),
      installed ? sectionOf(installed) : null,
    ]);
    return renderChangelogMarkdown({
      latest: latestSection,
      installed: installedSection,
    });
  }

  /** Installed versus newest recorded release of a CurseForge-published pack, for in-game update notices; throws NotFoundError without a pack or release. */
  async getVersionStatus(options: {
    curseforgeProjectId: number;
    installedVersion?: string;
  }): Promise<ModpackVersionStatus> {
    const modpack = await this.getPublishedModpack(options.curseforgeProjectId);
    const [latest] = await Q.modpack.release.findAll(
      { modpackId: modpack.id },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    if (!latest) {
      throw new NotFoundError(`${modpack.name} has no recorded release yet`);
    }
    if (!latest.version) {
      throw new NotFoundError(
        `${modpack.name} has no version recorded for its newest release`,
      );
    }

    const latestVersion = latest.version;
    const installed = options.installedVersion ?? null;
    if (
      installed === null ||
      installed === latestVersion ||
      isOlderVersion(latestVersion, installed)
    ) {
      return { latest: latestVersion, installed, outdated: false };
    }

    const [recorded] = await Q.modpack.release.findAll(
      { modpackId: modpack.id, version: installed },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );

    const outdated = recorded
      ? recorded.id < latest.id
      : isOlderVersion(installed, latestVersion);

    return { latest: latestVersion, installed, outdated };
  }

  /** PNG row of one entry of a recorded release's changelog; throws NotFoundError when the pack, release or entry is unknown. */
  async getChangelogRow(options: {
    curseforgeProjectId: number;
    releaseFileId: number;
    entryProjectId: number;
  }): Promise<ChangelogRowImage> {
    const modpack = await this.getPublishedModpack(options.curseforgeProjectId);
    const release = await Q.modpack.release.find({
      modpackId: modpack.id,
      curseforgeFileId: options.releaseFileId,
    });
    if (!release) {
      throw new NotFoundError(
        `${modpack.name} has no recorded release for file ${options.releaseFileId}`,
      );
    }
    const changelog = await getReleaseChangelog(modpack, release);
    for (const { key } of CHANGELOG_GROUPS) {
      const entry = changelog[key].find(
        (candidate) => candidate.projectId === options.entryProjectId,
      );
      if (entry) return renderChangelogRow(entry, key);
    }
    throw new NotFoundError(
      `Project ${options.entryProjectId} did not change in ${modpack.name} file ${options.releaseFileId}`,
    );
  }

  private async getPublishedModpack(
    curseforgeProjectId: number,
  ): Promise<Modpack> {
    const modpack = await Q.modpack.find({ curseforgeProjectId });
    if (!modpack) {
      throw new NotFoundError(
        `No modpack is published as CurseForge project ${curseforgeProjectId}`,
      );
    }
    return modpack;
  }
}

export const modpackReleaseService = new ModpackReleaseService();
