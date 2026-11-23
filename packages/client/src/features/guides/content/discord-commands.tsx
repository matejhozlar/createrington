import { MessageSquare } from "lucide-react";
import { DiscordCommandsGroup } from "@/features/guides/components/DiscordCommandsContent";
import type { Guide } from "@/features/guides/types";

export const discordCommandsGuide: Guide = {
  slug: "discord-commands",
  title: "Discord Commands",
  description: "Learn the most useful Discord bot commands for the server.",
  icon: MessageSquare,
  category: "discord",
  image: "/assets/guides/download/discord-hero.webp",
  imageIcon: "/assets/logo/discord.webp",
  estimatedMinutes: 5,
  steps: [
    {
      title: "Getting Started",
      description: "Essential commands for joining the server.",
      content: <DiscordCommandsGroup group="Getting Started" />,
    },
    {
      title: "Economy",
      description: "Manage your in-game money through Discord.",
      content: <DiscordCommandsGroup group="Economy" />,
    },
    {
      title: "Player Info",
      description: "Check stats, compare with others, and view profiles.",
      content: <DiscordCommandsGroup group="Player Info" />,
    },
    {
      title: "Server",
      description: "Check server status and online players.",
      content: <DiscordCommandsGroup group="Server" />,
    },
  ],
};
