import type { Request, Response } from "express";
import type {
  LauncherPackData,
  LauncherPackFilesData,
  LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import type { ResolveFilesBody } from "./launcher-pack.schemas";

export class LauncherPackController {
  static async latest(_req: Request, res: Response): Promise<void> {
    const body: LauncherSuccessResponse<LauncherPackData> = {
      success: true,
      data: await launcherPackService.getLatestPack(),
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
