import { BadRequestError } from "@/app/middleware";
import { modpackService } from "@/services/modpack";
import type { Request, Response } from "express";

const CURSEFORGE_ID_RE = /^[1-9]\d{0,9}$/;
const CURSEFORGE_ID_MAX = 2_147_483_647;
const VERSION_MAX = 64;
const CHANGELOG_CACHE_CONTROL = "public, max-age=300";
const ROW_CACHE_CONTROL = "public, max-age=86400";
const ROW_RETRY_CACHE_CONTROL = "public, max-age=60";
const VERSION_CACHE_CONTROL = "public, max-age=300";

function parseCurseforgeId(value: unknown, message: string): number {
  const id =
    typeof value === "string" && CURSEFORGE_ID_RE.test(value)
      ? Number(value)
      : 0;
  if (id < 1 || id > CURSEFORGE_ID_MAX) {
    throw new BadRequestError(message);
  }
  return id;
}

function parseProjectId(value: unknown): number {
  return parseCurseforgeId(value, "project must be a CurseForge project id");
}

function parseVersion(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const version = value.trim();
  return version === "" || version.length > VERSION_MAX ? undefined : version;
}

export class ModpacksController {
  /**
   * GET /api/modpacks/:project/changelog.md
   * GET /api/modpacks/:project/changelog/:version.md
   *
   * Changelog of the newest recorded release of the modpack published as CurseForge project `:project`, as Markdown (`text/plain`) in the dialect FancyMenu's text element renders: header, then one clickable row image per added / updated / removed entry (see the rows endpoint), then the publish notes. Kept under 16,000 characters (FancyMenu refuses 17,000+) by dropping the CurseForge links, then capping each change group with an "…and N more" line.
   *
   * `:version` is the pack `manifest.json` version the player runs. When it names an older recorded release, that release's changelog follows under a label and the player is flagged as outdated; an unknown or current version renders the newest release only. Errors use the standard `{ success: false, message, error }` envelope: 400 for a malformed project id, 404 when no modpack is published under it or it has no recorded release. Cacheable for 5 minutes.
   */
  static async getChangelog(req: Request, res: Response): Promise<void> {
    const markdown = await modpackService.getChangelogMarkdown({
      curseforgeProjectId: parseProjectId(req.params.project),
      installedVersion: parseVersion(req.params.version),
    });

    res.setHeader("Cache-Control", CHANGELOG_CACHE_CONTROL);
    res.type("text/plain; charset=utf-8");
    res.send(markdown);
  }

  /**
   * GET /api/modpacks/:project/version/:version.json
   *
   * Whether the pack `manifest.json` version `:version` the player runs is behind the newest recorded release of the modpack published as CurseForge project `:project`. Built for in-game update notices that fetch the URL directly.
   *
   * Response is a flat JSON body, not enveloped:
   * `{ latest, installed, outdated }`
   * Errors use the standard `{ success: false, message, error }` envelope: 400 for a malformed project id, 404 when no modpack is published under it or it has no recorded release.
   *
   * `outdated` is true only when the installed version is recorded as an older release, or parses as a lower dot-separated number than `latest`. A version that is unknown, newer, or not comparable reads as current, so a player on a dev or pre-release build is never told to update. `installed` is null when `:version` is malformed or longer than 64 characters. Cacheable for 5 minutes.
   */
  static async getVersionStatus(req: Request, res: Response): Promise<void> {
    const status = await modpackService.getVersionStatus({
      curseforgeProjectId: parseProjectId(req.params.project),
      installedVersion: parseVersion(req.params.version),
    });

    res.setHeader("Cache-Control", VERSION_CACHE_CONTROL);
    res.json(status);
  }

  /**
   * GET /api/modpacks/:project/changelog/rows/:release/:mod.png
   *
   * One changelog entry drawn as a transparent 752x72 PNG row: the mod icon, then its name and version change in the Minecraft font. `:release` is the release's CurseForge file id and `:mod` the entry's CurseForge project id, as linked from the changelog Markdown. Sized for a 188 GUI unit wide FancyMenu text element, where it matches vanilla text. Cacheable for a day, or a minute when the icon could not be fetched. 400 for malformed ids, 404 when the pack, release or entry is unknown.
   */
  static async getChangelogRow(req: Request, res: Response): Promise<void> {
    const row = await modpackService.getChangelogRow({
      curseforgeProjectId: parseProjectId(req.params.project),
      releaseFileId: parseCurseforgeId(
        req.params.release,
        "release must be a CurseForge file id",
      ),
      entryProjectId: parseCurseforgeId(
        req.params.mod,
        "mod must be a CurseForge project id",
      ),
    });

    res.setHeader(
      "Cache-Control",
      row.complete ? ROW_CACHE_CONTROL : ROW_RETRY_CACHE_CONTROL,
    );
    res.type("image/png");
    res.send(row.png);
  }
}
