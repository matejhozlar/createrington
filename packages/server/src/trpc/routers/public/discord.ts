import { publicProcedure, router } from "@/trpc/trpc";
import config from "@/config";

function camelToTitle(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function camelToKebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function reverseMap(
  obj: object,
  transform: (key: string) => string,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[value] = transform(key);
    }
  }
  return result;
}

/** Public Discord router — exposes entity ID-to-name maps for client-side mention resolution. */
export const discordRouter = router({
  entities: publicProcedure
    .meta({ description: "Get Discord entity ID-to-name maps for roles and channels" })
    .query(() => {
      const roles = reverseMap(config.discord.guild.roles, camelToTitle);

      const channels: Record<string, string> = {};
      for (const category of Object.values(config.discord.guild.channels)) {
        Object.assign(channels, reverseMap(category, camelToKebab));
      }

      return { roles, channels };
    }),
});
