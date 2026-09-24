import { Coins, Crown, MoonStar, type LucideIcon } from "lucide-react";
import { formatMoney } from "@createrington/shared/format";
import { mcHeadsBody } from "@/lib/external-urls";

export type TopRoleMetric = "playtime" | "balance" | "records";

export interface TopRoleStyle {
  icon: LucideIcon;
  color: string;
  tagline: string;
  boardTitle: string;
  boardDescription: string;
}

export const TOP_ROLE_STYLES: Record<string, TopRoleStyle> = {
  the_unrivaled: {
    icon: Crown,
    color: "#4C8DFF",
    tagline: "Holds the most #1 stat placements",
    boardTitle: "Records",
    boardDescription: "Players ranked #1 in the most contested stats",
  },
  the_sleepless: {
    icon: MoonStar,
    color: "#826BC2",
    tagline: "Most hours played across every season",
    boardTitle: "Playtime",
    boardDescription: "Total hours played across all servers",
  },
  capitalist: {
    icon: Coins,
    color: "#F5A623",
    tagline: "The richest player on the server",
    boardTitle: "Wealth",
    boardDescription: "Highest in-game balance right now",
  },
};

export const FALLBACK_TOP_ROLE_STYLE: TopRoleStyle = {
  icon: Crown,
  color: "#A1A1AA",
  tagline: "",
  boardTitle: "Leaderboard",
  boardDescription: "",
};

export const HERO_ORDER = ["the_sleepless", "the_unrivaled", "capitalist"];

export function topRoleStyle(roleKey: string): TopRoleStyle {
  return TOP_ROLE_STYLES[roleKey] ?? FALLBACK_TOP_ROLE_STYLE;
}

export function formatMetric(metric: TopRoleMetric, value: number): string {
  switch (metric) {
    case "playtime":
      return `${Math.floor(value / 3600).toLocaleString("en-US")} hours`;
    case "balance":
      return formatMoney(value);
    case "records":
      return `${value.toLocaleString("en-US")} ${value === 1 ? "record" : "records"}`;
  }
}

export function formatGap(metric: TopRoleMetric, value: number): string {
  if (metric === "playtime" && value < 3600) {
    return `${Math.max(1, Math.round(value / 60))} min`;
  }
  return formatMetric(metric, value);
}

export function figureSrc(holder: {
  imageUrl: string | null;
  minecraftUuid: string;
}): string {
  return holder.imageUrl ?? mcHeadsBody(holder.minecraftUuid);
}
