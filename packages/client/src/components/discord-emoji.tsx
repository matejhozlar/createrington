import { cn } from "@/lib/utils";
import { CUSTOM_EMOJI_PATTERN, customEmojiUrl } from "@/lib/discord-emoji";

interface DiscordEmojiProps {
  value: string;
  className?: string;
}

export function DiscordEmoji({ value, className }: DiscordEmojiProps) {
  const match = value.match(CUSTOM_EMOJI_PATTERN);
  if (!match) return <span className={className}>{value}</span>;

  const [, animated, name, id] = match;
  return (
    <img
      src={customEmojiUrl(id, animated === "a")}
      alt={`:${name}:`}
      title={`:${name}:`}
      draggable={false}
      className={cn("inline-block size-[1.375em] align-bottom", className)}
    />
  );
}
