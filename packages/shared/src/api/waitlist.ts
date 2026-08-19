import { z } from "zod";

export const waitlistDiscordNameSchema = z
  .string()
  .min(1, "Discord name too short")
  .max(100, "Discord name too long");

export const waitlistEmailSchema = z.string().email("Invalid email format");

/** Payload accepted by the public `waitlists.create` endpoint (waitlist mode only). */
export const waitlistCreateInputSchema = z.object({
  discordName: waitlistDiscordNameSchema,
  email: waitlistEmailSchema,
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

export type WaitlistCreateInput = z.infer<typeof waitlistCreateInputSchema>;

/** Client-side apply form schema; the form only renders in waitlist mode. */
export const waitlistFormSchema = z
  .object({
    discordName: z.string(),
    email: z.string(),
    referralSource: z.string(),
    referralOther: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.email.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required",
        path: ["email"],
      });
    } else if (!waitlistEmailSchema.safeParse(values.email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid email address",
        path: ["email"],
      });
    }

    if (!values.discordName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Discord username is required",
        path: ["discordName"],
      });
    }
  });
