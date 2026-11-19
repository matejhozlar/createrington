import { getValidated } from "@/app/middleware/validation.middleware";
import { modpackReleaseService } from "@/services/modpack/release.service";
import type { Request, Response } from "express";
import type {
  ChangelogRowParams,
  ProjectVersionParams,
} from "./modpacks.schemas";

const IN_GAME_CONTENT_CACHE_CONTROL = "public, max-age=300";
const ROW_CACHE_CONTROL = "public, max-age=86400";
const ROW_RETRY_CACHE_CONTROL = "public, max-age=60";

export class ModpacksController {
  static async getChangelog(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ProjectVersionParams }>(res);
    const markdown = await modpackReleaseService.getChangelogMarkdown({
      curseforgeProjectId: params.project,
      installedVersion: params.version,
    });

    res.setHeader("Cache-Control", IN_GAME_CONTENT_CACHE_CONTROL);
    res.type("text/plain; charset=utf-8");
    res.send(markdown);
  }

  static async getVersionStatus(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ProjectVersionParams }>(res);
    const status = await modpackReleaseService.getVersionStatus({
      curseforgeProjectId: params.project,
      installedVersion: params.version,
    });

    res.setHeader("Cache-Control", IN_GAME_CONTENT_CACHE_CONTROL);
    res.json(status);
  }

  static async getChangelogRow(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ChangelogRowParams }>(res);
    const row = await modpackReleaseService.getChangelogRow({
      curseforgeProjectId: params.project,
      releaseFileId: params.release,
      entryProjectId: params.mod,
    });

    res.setHeader(
      "Cache-Control",
      row.complete ? ROW_CACHE_CONTROL : ROW_RETRY_CACHE_CONTROL,
    );
    res.type("image/png");
    res.send(row.png);
  }
}
