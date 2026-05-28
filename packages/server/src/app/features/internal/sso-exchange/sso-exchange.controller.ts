import { BadRequestError, NotFoundError } from "@/app/middleware";
import { consumeSsoCode } from "@/services/auth/sso/code-store";
import type { Request, Response } from "express";

/**
 * Internal SSO Exchange Controller
 *
 * Redeems the one-time code minted by the SSO callback for the cross-service
 * identity payload. Codes are single-use and short-lived (60s); a miss means
 * unknown, expired, or already consumed.
 */
export class InternalSsoExchangeController {
  static async exchange(req: Request, res: Response): Promise<void> {
    const code = typeof req.body?.code === "string" ? req.body.code : undefined;

    if (!code) {
      throw new BadRequestError("code is required");
    }

    const payload = consumeSsoCode(code);
    if (!payload) {
      throw new NotFoundError("Unknown, expired, or already-consumed code");
    }

    res.json({
      success: true,
      data: {
        playerId: payload.playerId,
        minecraftUsername: payload.minecraftUsername,
        isMember: payload.isMember,
        isOwner: payload.isOwner,
      },
    });
  }
}
