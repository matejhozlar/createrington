import { z } from "zod";

export const waitlistDiscordNameSchema = z
  .string()
  .min(1, "Discord name too short")
  .max(100, "Discord name too long");

export const waitlistEmailSchema = z.string().email("Invalid email format");

/** Payload accepted by the public `waitlists.create` endpoint. */
export const waitlistCreateInputSchema = z.object({
  discordName: waitlistDiscordNameSchema.optional(),
  email: waitlistEmailSchema.optional(),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

export type WaitlistCreateInput = z.infer<typeof waitlistCreateInputSchema>;

// Waitlist mode requires Discord name + email; open enrollment only the terms checkbox.
export function buildWaitlistFormSchema(isWaitlistMode: boolean) {
  return z
    .object({
      discordName: z.string(),
      email: z.string(),
      referralSource: z.string(),
      referralOther: z.string(),
      agreedToTerms: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (!values.agreedToTerms) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "You must agree to the Privacy Policy and Terms of Service",
          path: ["agreedToTerms"],
        });
      }

      if (isWaitlistMode) {
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
      }
    });
}
