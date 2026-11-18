import type { Request, Response } from "express";
import { getValidated } from "@/app/middleware/validation.middleware";
import { respondSuccess } from "@/app/middleware/api-envelope";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import type {
  AvailableReleasesBody,
  PublishReleaseBody,
  UpdateCheckParams,
} from "./launcher-release.schemas";

export class LauncherReleaseController {
  static async publish(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: PublishReleaseBody }>(res);

    const release = await launcherReleaseService.publish(body);

    respondSuccess(res, {
      status: 201,
      data: {
        id: release.id,
        version: release.version,
        platform: release.platform,
        status: release.status,
      },
    });
  }

  static async setAvailable(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: AvailableReleasesBody }>(res);

    const pruned = await launcherReleaseService.prune(
      body.channel,
      body.versions,
    );

    respondSuccess(res, {
      data: {
        pruned: pruned.map((release) => ({
          id: release.id,
          version: release.version,
          platform: release.platform,
        })),
      },
    });
  }

  static async checkForUpdate(_req: Request, res: Response): Promise<void> {
    const { params } = getValidated<{ params: UpdateCheckParams }>(res);

    const update = await launcherReleaseService.checkForUpdate(
      params.platform,
      params.currentVersion,
    );

    if (!update) {
      res.status(204).end();
      return;
    }

    res.json(update);
  }
}
