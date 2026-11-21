import { adminProcedure } from "@/trpc/trpc";
import config from "@/config";

export const guildChannelsProcedure = adminProcedure
  .meta({ description: "Get all text channels grouped by category" })
  .query(() => {
    const categories = config.discord.guild.categories as unknown as Record<
      string,
      string
    >;
    return Object.entries(config.discord.guild.channels).map(
      ([category, channelMap]) => ({
        category,
        categoryId: categories[category] ?? "",
        channels: Object.entries(channelMap as Record<string, string>).map(
          ([name, id]) => ({ name, id }),
        ),
      }),
    );
  });
