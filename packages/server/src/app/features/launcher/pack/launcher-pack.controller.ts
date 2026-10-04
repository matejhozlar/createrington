import type { Request, Response } from "express";
import type {
  LauncherPackData,
  LauncherPackFilesData,
  LauncherPackReleasesData,
  LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import type {
  ListReleasesQuery,
  ResolveFilesBody,
} from "./launcher-pack.schemas";

export class LauncherPackController {
  static async latest(_req: Request, res: Response): Promise<void> {
    const body: LauncherSuccessResponse<LauncherPackData> = {
      success: true,
      data: await launcherPackService.getLatestPack(),
    };
    res.json(body);
  }

  static async releases(_req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: ListReleasesQuery }>(res);

    const body: LauncherSuccessResponse<LauncherPackReleasesData> = {
      success: true,
      data: await launcherPackService.listReleases(query),
    };
    res.json(body);
  }

  static async resolveFiles(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: ResolveFilesBody }>(res);

    const response: LauncherSuccessResponse<LauncherPackFilesData> = {
      success: true,
      data: await launcherPackService.resolveFiles(body.fileIds),
    };
    res.json(response);
  }
}
