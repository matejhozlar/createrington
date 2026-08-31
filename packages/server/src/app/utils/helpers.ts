import { DISCORD_ID_REGEX, MC_UUID_REGEX } from "@/utils/zod-schemas";

/**
 * Function to detect ID type
 * Properly detects between discordId, minecraftUuid, and minecraftUsername
 *
 * @param id - The ID to extract
 * @returns Type of ID
 */
export function getIdType(
  id: string,
): "minecraftUuid" | "minecraftUsername" | "discord" | "invalid" {
  const isMinecraftUUID = MC_UUID_REGEX.test(id);
  if (isMinecraftUUID) return "minecraftUuid";

  const isDiscordID = DISCORD_ID_REGEX.test(id);
  if (isDiscordID) return "discord";

  // Minecraft usernames: 3-16 characters, alphanumeric and underscore only
  const isMinecraftUsername = /^[a-zA-Z0-9_]{3,16}$/.test(id);
  if (isMinecraftUsername) return "minecraftUsername";

  return "invalid";
}

/**
 * Converts an ID string into a typed object based on its type
 *
 * @param id - The ID to convert
 * @returns Object with the appropriate key-value pair, or null if invalid
 */
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
