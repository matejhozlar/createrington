import {
  container,
  section,
  fullWidthSpacer,
  text,
  thumbnail,
} from "../../component-builder";
import { formatMoney, formatPlaytime } from "@createrington/shared/format";
import { formatDaysCount } from "@/utils/format";
import { Discord } from "@/discord/constants";
import type {
  ComponentContainer,
  ComponentsData,
} from "@createrington/shared/api/embed";

export type RankUpMetric =
  | { kind: "playtime"; seconds: number }
  | { kind: "balance"; amount: number }
  | { kind: "membership"; days: number }
  | { kind: "records"; count: number };

export interface RankUpAnnouncementInput {
  discordId: string;
  playerName: string;
  roleLabel: string;
  roleEmoji?: string;
  metric: RankUpMetric;
  poseUrl?: string;
  accentColor?: number;
  competitive: boolean;
}

function headline(input: RankUpAnnouncementInput): string {
  const player = Discord.Users.mention(input.discordId);

  if (input.competitive) {
    switch (input.metric.kind) {
      case "playtime":
        return `${player} now holds the most playtime on the server.`;
      case "balance":
        return `${player} now holds the largest fortune on the server.`;
      case "membership":
        return `${player} has been here longer than anyone else.`;
      case "records":
        return `${player} now places first in more stats than anyone else.`;
    }
  }

  return `${player} has ranked up.`;
}

function stat(metric: RankUpMetric): string {
  switch (metric.kind) {
    case "playtime":
      return `${formatPlaytime(metric.seconds)} total playtime`;
    case "balance":
      return `${formatMoney(metric.amount)} balance`;
    case "membership":
      return `${formatDaysCount(metric.days)} in the server`;
    case "records":
      return `${metric.count.toLocaleString("en-US")} first-place ${metric.count === 1 ? "stat" : "stats"}`;
  }
}

/** Components V2 renderings for the Hall of Fame channel. */
export const HallOfFameComponentPresets = {
  /**
   * The rank-up announcement: the new role as the heading (led by the role's
   * emoji when it has one), the rank-up line, the running total as subtext,
   * the player's skin posed beside it, and the role's own color as the
   * container stripe. A transparent full-width spacer
   * opens the container so every announcement renders at the same width
   * regardless of the length of the player's name.
   */
  rankUp(input: RankUpAnnouncementInput): ComponentsData {
    const lines = [
      `### ${input.roleEmoji ? `${input.roleEmoji} ` : ""}${input.roleLabel}`,
      headline(input),
      `-# ${stat(input.metric)}`,
    ];

    const children: ComponentContainer["components"] = [
      fullWidthSpacer(),
      ...(input.poseUrl
        ? [
            section(
              lines,
              thumbnail(input.poseUrl, {
                description: `${input.playerName}'s skin`,
              }),
            ),
          ]
        : lines.map(text)),
    ];

    return {
      components: [
        container(
          children,
          input.accentColor ? { accentColor: input.accentColor } : {},
        ),
      ],
    };
  },
};
