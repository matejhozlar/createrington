import { Router } from "express";
import { BadRequestError, route } from "@/app/middleware";
import type { Request, Response } from "express";

const router = Router();

/** Matches a Minecraft UUID (with/without dashes) or a valid username (3-16 alphanumeric/underscore) */
const MC_IDENTIFIER_RE = /^([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|[a-zA-Z0-9_]{3,16})$/;

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

    if (!MC_IDENTIFIER_RE.test(uuid)) {
      throw new BadRequestError("Invalid UUID format");
    }

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
