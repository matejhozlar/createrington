import { waitlist, waitlistRepo } from "@/db";
import type { Request, Response } from "express";
import {
  BadRequestError,
  ConflictError,
  TypedResponse,
} from "@/app/middleware";
import type { CreateWaitlistEntryResponse } from "@createrington/shared/api/public/waitlists";

/**
 * Waitlist controller
 *
 * Handles all waitlist related business logic
 */
export class WaitlistController {
  /**
   * Create a new waitlist entry
   *
   * POST /api/waitlist
   * Body: { email: string, discordName: string }
   */
  static async create(req: Request, res: Response): Promise<void> {
    const { email, discordName } = req.validatedBody;

    const emailsExists = await waitlist.entry.find({ email });
    if (emailsExists) {
      throw new ConflictError("This email is already on the waitlist");
    }

    const discordExists = await waitlist.entry.find({ discordName });
    if (discordExists) {
      throw new ConflictError(
        "This Discord username is already on the waitlist",
      );
    }

    const result = await waitlistRepo.register({
      email,
      discordName,
    });

    if (result.autoInvited && result.token) {
      return TypedResponse.created<CreateWaitlistEntryResponse>(res, {
        success: true,
        data: {
          entry: result.entry,
          autoInvited: true,
          token: result.token,
          redirectUrl: `/invite/${encodeURIComponent(result.token)}`,
        },
        message:
          "You were auto-invited. Check your email address for the invite link.",
      });
    } else {
      return TypedResponse.created<CreateWaitlistEntryResponse>(res, {
        success: true,
        data: {
          entry: result.entry,
          autoInvited: false,
        },
        message:
          "Thanks! We've added you to the waitlist. We'll contact you when a spot opens up.",
      });
    }
  }
}
