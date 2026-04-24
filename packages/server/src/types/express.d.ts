/**
 * Express Request/Response type augmentation
 *
 * Extends Express types with custom properties injected by
 * authentication and validation middleware.
 */

import type { JWTPayload } from "@/services/auth/jwt";
import type { ValidatedData } from "@/app/middleware/validation.middleware";

declare global {
  /**
   * JWT payload from Minecraft mod authentication.
   *
   * `uuid` and `name` are per-player claims: CRNet only emits them when the
   * caller supplies a playerUuid, so server-level tokens (heartbeats, syncs)
   * legitimately lack them. Routes that act on behalf of a specific player
   * enforce `uuid` presence via `requireKnownPlayer`.
   */
  interface ModJwtPayload {
    uuid?: string;
    name?: string;
    aud: string;
    iat: number;
    exp: number;
  }

  namespace Express {
    interface Request {
      /** Web JWT payload, set by authenticate/optionalAuth middleware */
      user?: JWTPayload;
      /** Resolved client IP address */
      clientIp?: string;
      /**
       * Mod JWT payload
       * Set by verifyModJwt middleware
       */
      modAuth?: ModJwtPayload;
      /**
       * Verified server IP address
       * Set by verifyServerIp middleware
       */
      serverIp?: string;
    }
    interface Response {
      locals: {
        validated?: ValidatedData;
        [key: string]: unknown;
      };
    }
  }
}

export {};
