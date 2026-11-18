import type { Request, Response } from "express";
import type {
  LauncherContentCategoriesData,
  LauncherContentChangelogData,
  LauncherContentFileBatchData,
  LauncherContentFileData,
  LauncherContentFilesData,
  LauncherContentFingerprintsData,
  LauncherContentProjectData,
  LauncherContentProjectsData,
  LauncherContentSearchData,
} from "@createrington/shared/launcher";
import { getValidated } from "@/app/middleware/validation.middleware";
import { respondSuccess } from "@/app/middleware/api-envelope";
import { launcherContentService } from "@/services/launcher/content/launcher-content.service";
import { buildPagination } from "@/trpc/utils";
import type {
  ContentIdParams,
  FileChangelogQuery,
  GetFilesBody,
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

    respondSuccess<LauncherContentSearchData>(res, {
      data: {
        projects,
        pagination: buildPagination(query.page, query.limit, total),
      },
    });
  }

  static async categories(_req: Request, res: Response): Promise<void> {
    const { query } = getValidated<{ query: ListCategoriesQuery }>(res);

    respondSuccess<LauncherContentCategoriesData>(res, {
      data: {
        categories: await launcherContentService.listCategories(query.kind),
      },
    });
  }

  static async projects(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: GetProjectsBody }>(res);

    respondSuccess<LauncherContentProjectsData>(res, {
      data: await launcherContentService.getProjects(body.projectIds),
    });
  }

  static async project(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ContentIdParams }>(res);

    respondSuccess<LauncherContentProjectData>(res, {
      data: {
        project: await launcherContentService.getProjectDetails(params.id),
      },
    });
  }

  static async fingerprints(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: IdentifyFingerprintsBody }>(res);

    respondSuccess<LauncherContentFingerprintsData>(res, {
      data: await launcherContentService.identifyFingerprints(
        body.fingerprints,
      ),
    });
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

    respondSuccess<LauncherContentFilesData>(res, {
      data: {
        files,
        pagination: buildPagination(query.page, query.limit, total),
      },
    });
  }

  static async file(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: ContentIdParams }>(res);

    respondSuccess<LauncherContentFileData>(res, {
      data: { file: await launcherContentService.getFile(params.id) },
    });
  }

  static async filesById(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: GetFilesBody }>(res);

    respondSuccess<LauncherContentFileBatchData>(res, {
      data: await launcherContentService.getFiles(body.fileIds),
    });
  }

  static async fileChangelog(_req: Request, res: Response): Promise<void> {
    const { params, query } = getValidated<{
      params: ContentIdParams;
      query: FileChangelogQuery;
    }>(res);

    respondSuccess<LauncherContentChangelogData>(res, {
      data: {
        changelog: await launcherContentService.getFileChangelog(
          params.id,
          query.projectId,
        ),
      },
    });
  }
}
