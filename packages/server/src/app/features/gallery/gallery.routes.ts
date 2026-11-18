import { route, validate } from "@/app/middleware";
import { Router } from "express";
import { GalleryController } from "./gallery.controller";
import { GallerySubmissionParamsSchema } from "./gallery.schemas";

const router = Router();

router.get(
  "/submissions/:id/original",
  ...route(
    "admin",
    validate({ params: GallerySubmissionParamsSchema }),
    GalleryController.original,
  ),
);

export default router;
