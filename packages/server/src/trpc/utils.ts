import { TRPCError } from "@trpc/server";
import { idToObject } from "@/app/utils/helpers";

export function parsePlayerId(id: string) {
  const identifier = idToObject(id);
  if (!identifier) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Invalid player ID. Must be a Discord ID, Minecraft UUID, or Minecraft Username.",
    });
  }
  return identifier;
}
