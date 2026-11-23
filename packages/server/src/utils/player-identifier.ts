import { isDiscordId } from "@createrington/shared/discord-id";
import { MC_USERNAME_REGEX, MC_UUID_REGEX } from "@/utils/zod-schemas";

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export function getIdType(
  id: string,
): "minecraftUuid" | "minecraftUsername" | "discord" | "invalid" {
  const isMinecraftUUID = MC_UUID_REGEX.test(id);
  if (isMinecraftUUID) return "minecraftUuid";

  if (isDiscordId(id)) return "discord";

  const isMinecraftUsername = MC_USERNAME_REGEX.test(id);
  if (isMinecraftUsername) return "minecraftUsername";

  return "invalid";
}

export type PlayerIdObject =
  | { minecraftUuid: string }
  | { minecraftUsername: string }
  | { discordId: string };

export function idToObject(id: string): PlayerIdObject | null {
  const type = getIdType(id);

  switch (type) {
    case "minecraftUuid":
      return { minecraftUuid: id };
    case "minecraftUsername":
      return { minecraftUsername: id };
    case "discord":
      return { discordId: id };
    case "invalid":
      return null;
  }
}
