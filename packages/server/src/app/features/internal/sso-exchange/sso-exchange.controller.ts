import { getValidated } from "@/app/middleware/validation.middleware";
import { respondSuccess } from "@/app/middleware/api-envelope";
import { NotFoundError } from "@/errors";
import { consumeSsoCode } from "@/services/auth/sso/code-store";
import type { Request, Response } from "express";
import type { SsoExchangeBody } from "./sso-exchange.schemas";

export class InternalSsoExchangeController {
  static async exchange(_req: Request, res: Response): Promise<void> {
    const {
      body: { code },
    } = getValidated<{ body: SsoExchangeBody }>(res);

    const payload = await consumeSsoCode(code);
    if (!payload) {
      throw new NotFoundError("Unknown, expired, or already-consumed code");
    }

    respondSuccess(res, {
      data: {
        playerId: payload.playerId,
        minecraftUsername: payload.minecraftUsername,
        isMember: payload.isMember,
        isOwner: payload.isOwner,
      },
    });
  }
}
