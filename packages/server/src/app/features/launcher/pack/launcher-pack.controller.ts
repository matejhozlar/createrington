import type { Request, Response } from "express";
import type {
  LauncherPackData,
  LauncherPackFilesData,
  LauncherPackReleasesData,
  LauncherPacksData,
  LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { launcherPackService } from "@/services/launcher/pack/launcher-pack.service";
import { buildPagination } from "@/trpc/utils";
import type {
  ListReleasesQuery,
  PackParams,
  ResolveFilesBody,
} from "./launcher-pack.schemas";

export class LauncherPackController {
  static async list(_req: Request, res: Response): Promise<void> {
    const body: LauncherSuccessResponse<LauncherPacksData> = {
      success: true,
      data: { packs: await launcherPackService.listPacks() },
    };
    res.json(body);
  }

  static async latest(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: PackParams }>(res);
    const body: LauncherSuccessResponse<LauncherPackData> = {
      success: true,
      data: await launcherPackService.getLatestPack(params.slug),
    };
    res.json(body);
  }

  static async releases(_req: Request, res: Response): Promise<void> {
    const { params, query } = getValidated<{
      params: PackParams;
      query: ListReleasesQuery;
    }>(res);
    const { releases, total } = await launcherPackService.listReleases(
      params.slug,
      query,
    );

    const body: LauncherSuccessResponse<LauncherPackReleasesData> = {
      success: true,
      data: {
        releases,
        pagination: buildPagination(query.page, query.limit, total),
      },
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
