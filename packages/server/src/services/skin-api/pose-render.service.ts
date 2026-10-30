import type { KnownPose } from "createrington-skin-api";
import { getSkinApiClient } from "./index";
import { POSE_RENDER_STYLE } from "./quality";
import { RenderMemo } from "./render-memo";

const WEB_POSE_RENDER = { width: 800, height: 1200 } as const;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_RENDERS = 64;

/**
 * Renders posed player figures for web pages (the leaderboards compare stage
 * and the render pages behind the Discord cards) at a web-sized resolution.
 * Renders are memoised per player and pose for a few hours, keeping the most
 * recent MAX_CACHED_RENDERS, and concurrent requests for the same figure share
 * one skin-api call. A failed render is dropped from the cache so the next
 * request retries it.
 */
export class PoseRenderService {
  private readonly memo = new RenderMemo<Buffer>(
    CACHE_TTL_MS,
    MAX_CACHED_RENDERS,
  );

  /** The PNG of `minecraftUuid` in `pose`, from cache when fresh. */
  render(minecraftUuid: string, pose: KnownPose): Promise<Buffer> {
    return this.memo.get(`${minecraftUuid.toLowerCase()}:${pose}`, async () =>
      Buffer.from(
        await getSkinApiClient().render({
          pose,
          source: { uuid: minecraftUuid },
          options: { ...WEB_POSE_RENDER, style: POSE_RENDER_STYLE },
        }),
      ),
    );
  }
}

export const poseRenderService = new PoseRenderService();
