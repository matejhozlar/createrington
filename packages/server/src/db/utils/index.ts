import type { Player } from "@/generated/db";
import { Q } from "..";

export * from "./errors";
export * from "./query-helpers";
export * from "./transactions";

/**
 * Checks if a user is a registered admin in the database
 *
 * @param user - Discord ID string or Player object
 * @returns Promise resolving to true if the user is an admin, false otherwise
 */
export async function isAdminDb(user: string | Player): Promise<boolean> {
  const discordId = typeof user === "string" ? user : user.discordId;
  return await Q.admin.exists({ discordId });
}
