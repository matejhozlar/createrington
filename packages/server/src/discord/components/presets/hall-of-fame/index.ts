import { container, section, text, thumbnail } from "../../component-builder";
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
  | { kind: "membership"; days: number };

export interface RankUpAnnouncementInput {
  discordId: string;
  playerName: string;
  roleLabel: string;
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
  }
}

/** Components V2 renderings for the Hall of Fame channel. */
export const HallOfFameComponentPresets = {
  /** The rank-up announcement: the new role as the heading, the rank-up line, the running total as subtext, the player's skin posed beside it, and the role's own color as the container stripe. */
  rankUp(input: RankUpAnnouncementInput): ComponentsData {
    const lines = [
      `### ${input.roleLabel}`,
      headline(input),
      `-# ${stat(input.metric)}`,
    ];

    const children: ComponentContainer["components"] = input.poseUrl
      ? [
          section(
            lines,
            thumbnail(input.poseUrl, {
              description: `${input.playerName}'s skin`,
            }),
          ),
        ]
      : lines.map(text);

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
