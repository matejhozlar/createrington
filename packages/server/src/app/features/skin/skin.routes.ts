import { Router } from "express";
import { route } from "@/app/middleware";
import type { Request, Response } from "express";

const router = Router();

/** External skin APIs tried in order until one succeeds */
const SKIN_SOURCES = [
  (uuid: string) => `https://crafatar.com/skins/${uuid}`,
  (uuid: string) => `https://mc-heads.net/skin/${uuid}`,
];

/**
 * Skin proxy routes
 * Base path: /api/skin
 *
 * Proxies Minecraft skin requests through the server to avoid
 * CORS issues with external skin APIs.
 */

// GET /api/skin/:uuid - Fetch a player skin by Minecraft UUID
router.get(
  "/:uuid",
  ...route("public", async (req: Request, res: Response) => {
    const uuid = req.params.uuid as string;

    for (const buildUrl of SKIN_SOURCES) {
      try {
        const response = await fetch(buildUrl(uuid), {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          res.setHeader("Content-Type", "image/png");
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.send(buffer);
          return;
        }
      } catch {
        // Try next source
      }
    }

    res.status(404).json({ error: "Skin not found" });
  }),
);

export default router;
