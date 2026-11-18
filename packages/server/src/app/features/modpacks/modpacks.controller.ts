import { BadRequestError } from "@/errors";
import { modpackReleaseService } from "@/services/modpack/release.service";
import type { Request, Response } from "express";

const CURSEFORGE_ID_RE = /^[1-9]\d{0,9}$/;
const CURSEFORGE_ID_MAX = 2_147_483_647;
const VERSION_MAX = 64;
const IN_GAME_CONTENT_CACHE_CONTROL = "public, max-age=300";
const ROW_CACHE_CONTROL = "public, max-age=86400";
const ROW_RETRY_CACHE_CONTROL = "public, max-age=60";

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
  static async getChangelog(req: Request, res: Response): Promise<void> {
    const markdown = await modpackReleaseService.getChangelogMarkdown({
      curseforgeProjectId: parseProjectId(req.params.project),
      installedVersion: parseVersion(req.params.version),
    });

    res.setHeader("Cache-Control", IN_GAME_CONTENT_CACHE_CONTROL);
    res.type("text/plain; charset=utf-8");
    res.send(markdown);
  }

  static async getVersionStatus(req: Request, res: Response): Promise<void> {
    const status = await modpackReleaseService.getVersionStatus({
      curseforgeProjectId: parseProjectId(req.params.project),
      installedVersion: parseVersion(req.params.version),
    });

    res.setHeader("Cache-Control", IN_GAME_CONTENT_CACHE_CONTROL);
    res.json(status);
  }

  static async getChangelogRow(req: Request, res: Response): Promise<void> {
    const row = await modpackReleaseService.getChangelogRow({
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
