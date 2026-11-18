import type { Player } from "@/generated/db";
import { Q } from "@/db";

export async function isAdminDb(user: string | Player): Promise<boolean> {
  const discordId = typeof user === "string" ? user : user.discordId;
  return await Q.admin.exists({ discordId });
}
