import { ExternalLink } from "lucide-react";
import { DiscordEmoji } from "@/components/discord-emoji";
import { DISCORD_COLORS } from "./colors";

interface DiscordButtonProps {
  label: string;
  emoji?: string;
  link?: boolean;
}

export function DiscordButton({
  label,
  emoji,
  link = true,
}: DiscordButtonProps) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 rounded px-4 py-2 text-sm font-medium text-white"
      style={{
        backgroundColor: link
          ? DISCORD_COLORS.secondaryButton
          : DISCORD_COLORS.blurple,
      }}
    >
      {emoji && <DiscordEmoji value={emoji} />}
      <span>{label}</span>
      {link && <ExternalLink className="size-3.5 opacity-60" />}
    </span>
  );
}
