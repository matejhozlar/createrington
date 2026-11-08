import config from "@/config";
import { Q } from "@/db";
import type {
  ChangelogEntry,
  ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";
import { refreshProjects } from "@/services/curseforge/ingest";
import { toLauncherPackProject } from "@/services/launcher/content/curseforge-content";
import { getReleaseChangelogs } from "@/services/modpack/release-changelog";
import type {
  LauncherPack,
  LauncherPackSource,
  Modpack,
  ModpackRelease,
} from "@createrington/shared/db";
import {
  LAUNCHER_APP_SOURCE,
  LAUNCHER_MODPACK_KIND,
  LauncherPackErrorCode,
  type LauncherPackChangelog,
  type LauncherPackChangelogEntry,
  type LauncherPackData,
  type LauncherPackFileSource,
  type LauncherPackProject,
  type LauncherPackRelease,
  type LauncherPackSummary,
} from "@createrington/shared/launcher";
import { packError } from "./pack-error";
import { parseModLoader } from "./pack-rules";
import { storageSnapshotUrl } from "./sandbox-files";

function toAppProject(slug: string, modpack: Modpack): LauncherPackProject {
  return {
    source: LAUNCHER_APP_SOURCE,
    id: String(modpack.id),
    slug,
    kind: LAUNCHER_MODPACK_KIND,
    name: modpack.name,
    summary: modpack.description,
    author: null,
    iconUrl: modpack.iconUrl,
    url: config.meta.links.website ?? APP_PROJECT_FALLBACK_URL,
  };
}

const ZIP_SERVED_BY: Record<LauncherPackSource, LauncherPackFileSource> = {
  curseforge: "curseforge",
  sandbox: "storage",
};

const PROJECT_LOOKUP_RETRY_MS = 60 * 1000;

const APP_PROJECT_FALLBACK_URL = "https://createrington.com";

export const PACK_ORDER = {
  orderBy: "position",
  orderDirection: "asc",
} as const;

function toPackData(
  release: ModpackRelease,
  project: LauncherPackProject,
  source: LauncherPackSource,
): LauncherPackData | null {
  const modLoader = release.modLoader
    ? parseModLoader(release.modLoader)
    : null;
  if (
    !release.version ||
    !release.minecraftVersion ||
    !modLoader ||
    release.javaMajorVersion === null ||
    !release.packFileName ||
    release.packFileSize === null ||
    !release.packSha1 ||
    !release.packDownloadUrl
  ) {
    return null;
  }

  return {
    project,
    version: release.version,
    releasedAt: release.publishedAt?.toISOString() ?? null,
    minecraftVersion: release.minecraftVersion,
    modLoader,
    javaMajorVersion: release.javaMajorVersion,
    zip: {
      fileId: release.curseforgeFileId,
      fileName: release.packFileName,
      url:
        source === "sandbox"
          ? storageSnapshotUrl(release.curseforgeFileId)
          : release.packDownloadUrl,
      size: release.packFileSize,
      sha1: release.packSha1,
      servedBy: ZIP_SERVED_BY[source],
    },
  };
}

function toChangelogEntry(entry: ChangelogEntry): LauncherPackChangelogEntry {
  return {
    projectId: entry.projectId,
    name: entry.name,
    url: entry.url,
    iconUrl: entry.thumbnailUrl,
    label: entry.label,
    previousLabel: entry.previousLabel,
    disabled: entry.disabled,
  };
}

function toPackChangelog(changelog: ChangelogInput): LauncherPackChangelog {
  return {
    previousVersion: changelog.previousVersion,
    added: changelog.added.map(toChangelogEntry),
    updated: changelog.updated.map(toChangelogEntry),
    removed: changelog.removed.map(toChangelogEntry),
    notes: changelog.notes,
  };
}

/**
 * Serves the launcher the modpacks the owner offers it: which packs there
 * are, which release of each is the latest, and which releases can still be
 * installed with what each of them changed. A pack is a `launcher_pack` row
 * keyed by the slug the launcher stores. A pack whose releases come from
 * CurseForge is described by its CurseForge project: its name, icon, summary
 * and page as CurseForge publishes them, read from the stored project and
 * never from the app's own modpack fields. A pack whose project is not stored
 * is asked for on CurseForge (at most once a minute) and is not served until
 * it is. A pack whose releases come from the sandbox is described by its
 * modpack row instead (name, description, icon), and its releases are the
 * snapshots `launcherPackReleaseService.prepareSnapshot` readied, the newest
 * one only. A release is offered as latest only once
 * `launcherPackReleaseService` has prepared it.
 */
export class LauncherPackService {
  private readonly projectLookups = new Map<
    number,
    { lookup: Promise<void>; startedAt: number }
  >();

  /**
   * Every enabled pack in the owner's order, each described for the pack list
   * (name, summary, icon, the server it belongs to) with its newest ready
   * release, or `latest: null` while it has none. A pack served from
   * CurseForge takes its description from its project, and from its modpack
   * row while the project cannot be served.
   */
  async listPacks(): Promise<LauncherPackSummary[]> {
    const packs = await Q.launcher.pack.findAll({ enabled: true }, PACK_ORDER);
    return Promise.all(packs.map((pack) => this.describePack(pack)));
  }

  /** The newest release of the pack that is ready for the launcher, with the project that identifies the pack. Throws `PACK_NOT_FOUND` (404) for a slug no enabled pack carries and `PACK_UNAVAILABLE` (404) when no release is ready or the pack's project cannot be served. */
  async getLatestPack(slug: string): Promise<LauncherPackData> {
    const pack = await this.requirePack(slug);
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const project = await this.projectFor(pack, modpack);
    const release = project ? await this.findLatestRelease(modpack.id) : null;
    const data =
      release && project ? toPackData(release, project, pack.source) : null;
    if (!data) {
      throw packError(
        LauncherPackErrorCode.PACK_UNAVAILABLE,
        404,
        "No modpack release is available to the launcher yet",
      );
    }
    return data;
  }

  /**
   * Every release of the pack the launcher can install, newest first: ready
   * for the launcher and not found archived on CurseForge by the last
   * `launcherPackReleaseService.checkReleases`. Each comes with its changelog:
   * the mods it added, updated and removed against the release recorded before
   * it (listed or not), and the publish notes. Paged, `page` counts from 0,
   * with `total` counting every listed release. With `version` only the
   * installable release of that version is listed, so the launcher finds a
   * kept release in one request. Reads the database only, unless the pack's
   * project is not stored yet. Throws `PACK_NOT_FOUND` (404) for a slug no
   * enabled pack carries. Empty when there is no release, when the page is
   * past the end, when no installable release carries the version, and while
   * the pack's project cannot be served.
   */
  async listReleases(
    slug: string,
    paging: { page: number; limit: number; version?: string },
  ): Promise<{ releases: LauncherPackRelease[]; total: number }> {
    const { page, limit, version } = paging;
    const pack = await this.requirePack(slug);
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const project = await this.projectFor(pack, modpack);
    if (!project) return { releases: [], total: 0 };

    const filters = {
      modpackId: modpack.id,
      launcherReadyAt: { $ne: null },
      launcherUnavailableAt: null,
      ...(version === undefined ? {} : { version }),
    };
    const [rows, total] = await Promise.all([
      Q.modpack.release.findAll(filters, {
        orderBy: "id",
        orderDirection: "desc",
        limit,
        offset: page * limit,
      }),
      Q.modpack.release.count(filters),
    ]);
    const servable = rows.flatMap((row) => {
      const data = toPackData(row, project, pack.source);
      if (!data) {
        logger.warn(
          `${modpack.name} release #${row.id} is ready for the launcher but cannot be served: a pack field is missing`,
        );
        return [];
      }
      return [{ row, data }];
    });
    const changelogs = await getReleaseChangelogs(
      modpack,
      servable.map(({ row }) => row),
    );
    const releases = servable.map(({ data }, index): LauncherPackRelease => ({
      ...data,
      changelog: toPackChangelog(changelogs[index]),
    }));
    return { releases, total };
  }

  private async requirePack(slug: string): Promise<LauncherPack> {
    const pack = await Q.launcher.pack.find({ slug });
    if (!pack?.enabled) {
      throw packError(
        LauncherPackErrorCode.PACK_NOT_FOUND,
        404,
        "The launcher offers no pack by this name",
      );
    }
    return pack;
  }

  /** The newest release of the modpack that is ready for the launcher, or null. */
  async findLatestRelease(modpackId: number): Promise<ModpackRelease | null> {
    const [release] = await Q.modpack.release.findAll(
      { modpackId, launcherReadyAt: { $ne: null } },
      { orderBy: "id", orderDirection: "desc", limit: 1 },
    );
    return release ?? null;
  }

  private async describePack(pack: LauncherPack): Promise<LauncherPackSummary> {
    const modpack = await Q.modpack.get({ id: pack.modpackId });
    const server = modpack.serverId
      ? await Q.server.find(
          { id: modpack.serverId },
          { select: ["id", "name", "identifier"] },
        )
      : null;
    const project = await this.projectFor(pack, modpack);
    const release = project ? await this.findLatestRelease(modpack.id) : null;

    return {
      slug: pack.slug,
      source: pack.source,
      name: project?.name ?? modpack.name,
      summary: project?.summary ?? modpack.description,
      iconUrl: project?.iconUrl ?? null,
      server,
      latest:
        release && project ? toPackData(release, project, pack.source) : null,
    };
  }

  private async projectFor(
    pack: LauncherPack,
    modpack: Modpack,
  ): Promise<LauncherPackProject | null> {
    return pack.source === "curseforge"
      ? this.loadPackProject(modpack)
      : toAppProject(pack.slug, modpack);
  }

  private async loadPackProject(
    modpack: Modpack,
  ): Promise<LauncherPackProject | null> {
    const projectId = modpack.curseforgeProjectId;
    if (projectId === null) return null;

    let row = await Q.curseforge.project.find({ id: projectId });
    if (!row) {
      await this.storePackProject(projectId);
      row = await Q.curseforge.project.find({ id: projectId });
    }
    const project = row ? toLauncherPackProject(row) : null;
    if (!project) {
      logger.warn(
        `${modpack.name} cannot be served to the launcher: CurseForge project #${projectId} is ${row ? "not a modpack" : "not stored"}`,
      );
    }
    return project;
  }

  private storePackProject(projectId: number): Promise<void> {
    const held = this.projectLookups.get(projectId);
    if (held && Date.now() - held.startedAt < PROJECT_LOOKUP_RETRY_MS) {
      return held.lookup;
    }

    const lookup = refreshProjects([projectId]).then(
      () => undefined,
      (error) => {
        logger.warn(
          `CurseForge project #${projectId} of the launcher's pack could not be stored:`,
          error,
        );
      },
    );
    this.projectLookups.set(projectId, { lookup, startedAt: Date.now() });
    return lookup;
  }
}

export const launcherPackService = new LauncherPackService();
