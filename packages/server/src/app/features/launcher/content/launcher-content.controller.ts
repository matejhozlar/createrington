import type { Request, Response } from "express";
import type {
  LauncherContentCategoriesData,
  LauncherContentFileData,
  LauncherContentFilesData,
  LauncherContentFingerprintsData,
  LauncherContentProjectsData,
  LauncherContentSearchData,
  LauncherSuccessResponse,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { launcherContentService } from "@/services/launcher/content/launcher-content.service";
import { buildPagination } from "@/trpc/utils";
import type {
  ContentIdParams,
  GetProjectsBody,
  IdentifyFingerprintsBody,
  ListCategoriesQuery,
  ListFilesQuery,
  SearchContentQuery,
} from "./launcher-content.schemas";

export class LauncherContentController {
  static async search(_req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: SearchContentQuery }>(res);
    const { categoryId: categoryIds, ...search } = query;
    const { projects, total } = await launcherContentService.search({
      ...search,
      categoryIds,
    });

    const body: LauncherSuccessResponse<LauncherContentSearchData> = {
      success: true,
      data: {
        projects,
        pagination: buildPagination(query.page, query.limit, total),
      },
    };
    res.json(body);
  }

  static async categories(_req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: ListCategoriesQuery }>(res);

    const body: LauncherSuccessResponse<LauncherContentCategoriesData> = {
      success: true,
      data: {
        categories: await launcherContentService.listCategories(query.kind),
      },
    };
    res.json(body);
  }

  static async projects(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: GetProjectsBody }>(res);

    const response: LauncherSuccessResponse<LauncherContentProjectsData> = {
      success: true,
      data: await launcherContentService.getProjects(body.projectIds),
    };
    res.json(response);
  }

  static async fingerprints(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: IdentifyFingerprintsBody }>(res);

    const response: LauncherSuccessResponse<LauncherContentFingerprintsData> = {
      success: true,
      data: await launcherContentService.identifyFingerprints(
        body.fingerprints,
      ),
    };
    res.json(response);
  }

  static async files(_req: Request, res: Response): Promise<void> {
    const { params, query } = getValidated<{
      params: ContentIdParams;
      query: ListFilesQuery;
    }>(res);
    const { files, total } = await launcherContentService.listFiles(
      params.id,
      query,
    );

    const body: LauncherSuccessResponse<LauncherContentFilesData> = {
      success: true,
      data: {
        files,
        pagination: buildPagination(query.page, query.limit, total),
      },
    };
    res.json(body);
  }

  static async file(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ContentIdParams }>(res);

    const body: LauncherSuccessResponse<LauncherContentFileData> = {
      success: true,
      data: { file: await launcherContentService.getFile(params.id) },
    };
    res.json(body);
  }
}
