import { KNOWN_POSES, type KnownPose } from "createrington-skin-api";
import { formatMoney } from "@createrington/shared/format";
import type { RouterOutput } from "@/lib/trpc";

export type ComparedPlayer =
  RouterOutput["public"]["leaderboards"]["compare"][number];

export const SIDE_COLORS = ["#4C8DFF", "#FF7A45"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const UNSTAGED_POSES: ReadonlySet<KnownPose> = new Set(["shipped", "toasty"]);
const STAGE_POSES = KNOWN_POSES.filter((pose) => !UNSTAGED_POSES.has(pose));

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return value >>> 0;
}

export function stagePoses(
  keys: [string, string],
  seed: string,
): [KnownPose, KnownPose] {
  const first = STAGE_POSES[hash(`${keys[0]}:${seed}`) % STAGE_POSES.length];
  const rest = STAGE_POSES.filter((pose) => pose !== first);
  const second = rest[hash(`${keys[1]}:${seed}`) % rest.length];
  return [first, second];
}

export function poseSrc(minecraftUuid: string, pose: KnownPose): string {
  return `/api/skin/${minecraftUuid}/pose/${pose}`;
}

export function compareHref(first: string, second?: string | null): string {
  const params = new URLSearchParams({ a: first });
  if (second) params.set("b", second);
  return `/leaderboards/compare?${params}`;
}

function daysSince(date: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / DAY_MS));
}

export interface HeadlineMetric {
  label: string;
  value: (player: ComparedPlayer, now: number) => number;
  display: (player: ComparedPlayer, now: number) => string;
}

export const HEADLINE_METRICS: HeadlineMetric[] = [
  {
    label: "Playtime",
    value: (player) => player.playtimeSeconds,
    display: (player) =>
      `${Math.floor(player.playtimeSeconds / 3600).toLocaleString("en-US")}h`,
  },
  {
    label: "Balance",
    value: (player) => player.balance,
    display: (player) => formatMoney(player.balance),
  },
  {
    label: "Records held",
    value: (player) => player.records,
    display: (player) => player.records.toLocaleString("en-US"),
  },
  {
    label: "Sessions",
    value: (player) => player.sessions,
    display: (player) => player.sessions.toLocaleString("en-US"),
  },
  {
    label: "Current streak",
    value: (player) => player.streak,
    display: (player) =>
      `${player.streak.toLocaleString("en-US")} ${player.streak === 1 ? "day" : "days"}`,
  },
  {
    label: "Member since",
    value: (player, now) => daysSince(player.memberSince, now),
    display: (player) =>
      new Date(player.memberSince).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      }),
  },
];

export const RANK_LABELS = [
  { board: "playtime", label: "Playtime" },
  { board: "balance", label: "Wealth" },
  { board: "records", label: "Records" },
] as const;
