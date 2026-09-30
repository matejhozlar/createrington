import type { Request, Response } from "express";
import { getValidated } from "@/app/middleware/validation.middleware";
import { launcherReleaseService } from "@/services/launcher/release/launcher-release.service";
import type { PublishReleaseBody } from "./launcher-release.schemas";

export class LauncherReleaseController {
  static async publish(_req: Request, res: Response): Promise<void> {
    const { body } = getValidated<{ body: PublishReleaseBody }>(res);

    const release = await launcherReleaseService.publish(body);

    res.status(201).json({
      success: true,
      data: {
        id: release.id,
        version: release.version,
        platform: release.platform,
        status: release.status,
      },
    });
  }

  static async checkForUpdate(req: Request, res: Response): Promise<void> {
    const platform = String(req.params.platform ?? "");
    const currentVersion = String(req.params.currentVersion ?? "");

    const update = await launcherReleaseService.checkForUpdate(
      platform,
      currentVersion,
    );

    if (!update) {
      res.status(204).end();
      return;
    }

    res.json(update);
  }
}
