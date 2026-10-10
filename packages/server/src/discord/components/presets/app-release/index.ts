import {
  actionRow,
  container,
  linkButton,
  separator,
  text,
} from "../../component-builder";
import { ComponentColors } from "../../colors";
import {
  CHANGE_KINDS,
  type ChangeKind,
  type ReleaseSummary,
} from "@/services/app-changelog";
import { formatDate } from "@createrington/shared/format";
import type { ComponentsData } from "@createrington/shared/api/embed";

export interface AppReleaseNotice {
  version: string;
  /** The version's changelog section, null when the changelog has none */
  summary: ReleaseSummary | null;
  changelogUrl: string;
}

const KIND_LABELS: Record<ChangeKind, [singular: string, plural: string]> = {
  add: ["addition", "additions"],
  fix: ["fix", "fixes"],
  refactor: ["refactor", "refactors"],
  remove: ["removal", "removals"],
  security: ["security fix", "security fixes"],
  chore: ["chore", "chores"],
  other: ["other change", "other changes"],
};

function countsLine(counts: ReleaseSummary["counts"]): string {
  return CHANGE_KINDS.filter((kind) => counts[kind] > 0)
    .map((kind) => {
      const count = counts[kind];
      const [singular, plural] = KIND_LABELS[kind];
      return `**${count}** ${count === 1 ? singular : plural}`;
    })
    .join(" · ");
}

/** Components V2 presets for releases of the app itself */
export const AppReleaseComponentPresets = {
  /** Admin-facing notice that a new app version is live, with change counts and a changelog link */
  live(data: AppReleaseNotice): ComponentsData {
    const lines = [`### App v${data.version} is live`];

    if (data.summary) {
      lines.push(`-# Released ${formatDate(data.summary.date)}`);
      const counts = countsLine(data.summary.counts);
      if (counts) lines.push(counts);
    }

    return {
      components: [
        container(
          [
            text(lines.join("\n")),
            separator(),
            actionRow([linkButton("View changelog", data.changelogUrl)]),
          ],
          { accentColor: ComponentColors.Success },
        ),
      ],
    };
  },
};
