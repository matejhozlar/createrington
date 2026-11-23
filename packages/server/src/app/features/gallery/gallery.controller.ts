import type { Request, Response } from "express";
import { getValidated } from "@/app/middleware/validation.middleware";
import type { GallerySubmissionParams } from "./gallery.schemas";
import { NotFoundError } from "@/errors";
import { Q } from "@/db";
import { getServiceSync, Services } from "@/services";

const ORIGINAL_CACHE_CONTROL = "private, max-age=300";

export class GalleryController {
  static async original(_req: Request, res: Response): Promise<void> {
    const {
      params: { id },
    } = getValidated<{ params: GallerySubmissionParams }>(res);

    const submission = await Q.gallery.submission.find({ id });
    if (
      !submission ||
      (submission.status !== "pending" && submission.status !== "approved")
    ) {
      throw new NotFoundError("Gallery submission not found");
    }

    const gallery = getServiceSync(Services.GALLERY_SERVICE);

    await new Promise<void>((resolve, reject) => {
      res.sendFile(
        submission.originalPath,
        {
          root: gallery.originalsDir,
          dotfiles: "deny",
          headers: {
            "Content-Type": submission.originalContentType,
            "Cache-Control": ORIGINAL_CACHE_CONTROL,
          },
        },
        (error) => {
          if (!error) {
            resolve();
            return;
          }
          if (res.headersSent) {
            resolve();
            return;
          }
          const code = (error as NodeJS.ErrnoException).code;
          reject(
            code === "ENOENT"
              ? new NotFoundError("Gallery original is no longer stored")
              : error,
          );
        },
      );
    });
  }
}
