import type { Request, Response } from "express";
import { NotFoundError } from "@/app/middleware";
import { Q } from "@/db";
import { container, Services } from "@/services/container";

const ORIGINAL_CACHE_CONTROL = "private, max-age=300";

export class GalleryController {
  static async original(req: Request, res: Response): Promise<void> {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw new NotFoundError("Gallery submission not found");
    }

    const submission = await Q.gallery.submission.find({ id });
    if (
      !submission ||
      (submission.status !== "pending" && submission.status !== "approved")
    ) {
      throw new NotFoundError("Gallery submission not found");
    }

    const gallery = container.getSync(Services.GALLERY_SERVICE);

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
          // Once the body is streaming there is no status left to set, so a
          // late failure (an aborted download) must not reach the error
          // handler, which would throw on the already-sent headers.
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
