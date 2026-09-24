import { Router } from "express";
import type { Request, Response } from "express";
import { route } from "@/app/middleware";
import { leaderboardOgCardService } from "@/services/leaderboard/og-card.service";

const CARD_CACHE_SECONDS = 60 * 60;
const DEGRADED_CARD_CACHE_SECONDS = 5 * 60;
const FALLBACK_CARD_PATH = "/assets/og/og-card.png";

const router = Router();

router.get(
  "/leaderboards.png",
  ...route("public", async (_req: Request, res: Response) => {
    try {
      const { png, degraded } = await leaderboardOgCardService.render();
      res.setHeader("Content-Type", "image/png");
      res.setHeader(
        "Cache-Control",
        `public, max-age=${degraded ? DEGRADED_CARD_CACHE_SECONDS : CARD_CACHE_SECONDS}`,
      );
      res.send(png);
    } catch (error) {
      logger.warn("Leaderboards OG card render failed:", error);
      res.redirect(302, FALLBACK_CARD_PATH);
    }
  }),
);

export default router;
