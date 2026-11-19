import { z } from "zod";

export const SsoExchangeBodySchema = z.object({
  code: z.string({ error: "code is required" }).min(1, "code is required"),
});

export type SsoExchangeBody = z.infer<typeof SsoExchangeBodySchema>;
