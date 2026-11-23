import { Router } from "express";
import config from "@/config";
import {
  requireHeaderSecret,
  requireLoopback,
  route,
  validate,
} from "@/app/middleware";
import { RenderController } from "./render.controller";
import {
  CompareQuerySchema,
  DesignQuerySchema,
  PlayerQuerySchema,
  TopQuerySchema,
} from "./render.schemas";

const router = Router();

router.use(requireLoopback);
router.use(
  requireHeaderSecret(
    "x-render-secret",
    () => config.puppeteer.secret,
    "render secret",
  ),
);

router.get(
  "/compare",
  ...route(
    "public",
    validate({ query: CompareQuerySchema }),
    RenderController.compare,
  ),
);

router.get(
  "/profile",
  ...route(
    "public",
    validate({ query: PlayerQuerySchema }),
    RenderController.profile,
  ),
);

router.get(
  "/activity",
  ...route(
    "public",
    validate({ query: PlayerQuerySchema }),
    RenderController.activity,
  ),
);

router.get(
  "/top",
  ...route("public", validate({ query: TopQuerySchema }), RenderController.top),
);

router.get(
  "/tag",
  ...route(
    "public",
    validate({ query: DesignQuerySchema }),
    RenderController.tag,
  ),
);

router.get("/records", ...route("public", RenderController.records));

export default router;
