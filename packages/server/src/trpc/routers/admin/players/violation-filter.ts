import { z } from "zod";
import { mcUuid } from "@/utils/zod-schemas";
import type { ViolationRequirement } from "@/db/queries/player";

const violationFilterSchema = z.object({
  minecraftUuid: mcUuid.toLowerCase().optional(),
  hasStrikes: z.boolean().optional(),
  hasBans: z.boolean().optional(),
  hasViolations: z.boolean().optional(),
});

export const violationFilterInput = violationFilterSchema.shape;

type ViolationFilterInput = z.infer<typeof violationFilterSchema>;

export function violationRequirement(
  input: ViolationFilterInput,
): ViolationRequirement | "none" | null {
  if (
    input.hasStrikes === undefined &&
    input.hasBans === undefined &&
    input.hasViolations === undefined
  ) {
    return null;
  }
  if (input.hasViolations === true) return "either";
  if (input.hasStrikes === true && input.hasBans === true) return "both";
  if (input.hasStrikes === true) return "strikes";
  if (input.hasBans === true) return "bans";
  return "none";
}
