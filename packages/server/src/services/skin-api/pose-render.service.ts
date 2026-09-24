import type { KnownPose } from "createrington-skin-api";
import { getSkinApiClient } from "./index";
import { POSE_RENDER_STYLE } from "./quality";

const WEB_POSE_RENDER = { width: 800, height: 1200 } as const;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_RENDERS = 64;

interface CachedRender {
  png: Promise<Buffer>;
  expiresAt: number;
}

/**
 * Renders posed player figures for public web pages (the leaderboards compare
 * stage) at a web-sized resolution. Renders are memoised per player and pose
 * for a few hours, keeping the most recent MAX_CACHED_RENDERS, and concurrent
 * requests for the same figure share one skin-api call. A failed render is
 * dropped from the cache so the next request retries it.
 */
export class PoseRenderService {
  private cache = new Map<string, CachedRender>();

  /** The PNG of `minecraftUuid` in `pose`, from cache when fresh. */
  render(minecraftUuid: string, pose: KnownPose): Promise<Buffer> {
    const key = `${minecraftUuid.toLowerCase()}:${pose}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.png;

    const png = getSkinApiClient()
      .render({
        pose,
        source: { uuid: minecraftUuid },
        options: { ...WEB_POSE_RENDER, style: POSE_RENDER_STYLE },
      })
      .then((bytes) => Buffer.from(bytes))
      .catch((error) => {
        this.cache.delete(key);
        throw error;
      });

    this.cache.delete(key);
    this.cache.set(key, { png, expiresAt: Date.now() + CACHE_TTL_MS });
    while (this.cache.size > MAX_CACHED_RENDERS) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return png;
  }
}

export const poseRenderService = new PoseRenderService();
