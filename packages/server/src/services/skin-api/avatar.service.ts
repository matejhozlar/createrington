import { createHash } from "node:crypto";
import { getSkinApiClient } from "./index";
import { RenderMemo } from "./render-memo";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_AVATARS = 1024;

export const AVATAR_DEFAULT_SIZE = 64;
export const AVATAR_MIN_SIZE = 8;
export const AVATAR_MAX_SIZE = 512;

export interface PlayerAvatar {
  png: Buffer;
  etag: string;
}

/**
 * Serves the flat 2D player heads behind the public avatar route. Heads are
 * memoised per player and size for a few hours, keeping the most recent
 * MAX_CACHED_AVATARS, and concurrent requests for the same head share one
 * skin-api call. A failed fetch is dropped from the cache so the next request
 * retries it. The ETag is a hash of the PNG bytes, so a changed skin produces
 * a new tag and an unchanged one validates as 304.
 */
export class AvatarService {
  private readonly memo = new RenderMemo<PlayerAvatar>(
    CACHE_TTL_MS,
    MAX_CACHED_AVATARS,
  );

  /** The head PNG of `minecraftUuid` at `size` pixels with its ETag, from cache when fresh. */
  get(minecraftUuid: string, size: number): Promise<PlayerAvatar> {
    return this.memo.get(`${minecraftUuid.toLowerCase()}:${size}`, async () => {
      const png = Buffer.from(
        await getSkinApiClient().avatar({
          source: { uuid: minecraftUuid },
          options: { size },
        }),
      );
      const hash = createHash("sha1").update(png).digest("hex");
      return { png, etag: `"${hash}"` };
    });
  }
}

export const avatarService = new AvatarService();
