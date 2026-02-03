import { waitlist, waitlistRepo } from "@/db";
import { Request, Response } from "express";
import { BadRequestError, ConflictError } from "@/app/middleware";

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
    const { email, discordName } = req.body;

    if (!email || !discordName) {
      throw new BadRequestError("Email and Discord name are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestError("Invalid email format");
    }

    const emailExists = await waitlist.entry.find({ email });
    if (emailExists) {
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
      res.status(201).json({
        success: true,
        data: {
          entry: result.entry,
          autoInvited: true,
          token: result.token,
          redirectUrl: `/invite/${encodeURIComponent(result.token)}`,
        },
        message: "You were auto-invited. Check your email for the invite link.",
      });
    } else {
      res.status(201).json({
        sucess: true,
        data: {
          entry: result.entry,
          autoInvited: false,
        },
        message:
          "Thanks! We've added you to the waitlist. We'll contact when a spot opens up.",
      });
    }
  }
}
