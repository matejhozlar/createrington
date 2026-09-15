import { route } from "@/app/middleware";
import { Router } from "express";
import { GalleryController } from "./gallery.controller";

const router = Router();

router.get(
  "/submissions/:id/original",
  ...route("admin", GalleryController.original),
);

export default router;
