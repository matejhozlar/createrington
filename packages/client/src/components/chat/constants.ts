import { MessageSource } from "@createrington/shared/socket";

export interface SourceConfig {
  label: string;
  color: string;
  bgColor: string;
  accentColor: string;
}

export const SOURCE_CONFIG: Record<MessageSource, SourceConfig> = {
  [MessageSource.SYSTEM]: {
    label: "System",
    color: "text-muted-foreground",
    bgColor: "bg-muted/40",
    accentColor: "hsl(var(--muted-foreground))",
  },
  [MessageSource.DISCORD]: {
    label: "Discord",
    color: "text-discord-foreground",
    bgColor: "bg-discord/10",
    accentColor: "var(--discord)",
  },
  [MessageSource.MINECRAFT]: {
    label: "Minecraft",
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    accentColor: "hsl(var(--chart-2))",
  },
  [MessageSource.WEB]: {
    label: "Web",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    accentColor: "hsl(var(--chart-3))",
  },
};
