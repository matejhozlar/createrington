import {
  DISCORD_ID_REGEX,
  MC_USERNAME_REGEX,
  MC_UUID_REGEX,
} from "@/utils/zod-schemas";

export function getIdType(
  id: string,
): "minecraftUuid" | "minecraftUsername" | "discord" | "invalid" {
  const isMinecraftUUID = MC_UUID_REGEX.test(id);
  if (isMinecraftUUID) return "minecraftUuid";

  const isDiscordID = DISCORD_ID_REGEX.test(id);
  if (isDiscordID) return "discord";

  const isMinecraftUsername = MC_USERNAME_REGEX.test(id);
  if (isMinecraftUsername) return "minecraftUsername";

  return "invalid";
}

export function idToObject(
  id: string,
):
  | { minecraftUuid: string }
  | { minecraftUsername: string }
  | { discordId: string }
  | null {
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
