import {
  CHANGELOG_GROUPS,
  type ChangelogEntry,
  type ChangelogInput,
} from "@/discord/components/presets/modpack-changelog";

interface RenderOptions {
  linked: boolean;
  cap: number;
}

export const CHANGELOG_MARKDOWN_MAX_LENGTH = 16_000;
export const CHANGELOG_ROWS_PER_GROUP_MAX = 25;

const MUTED = "#AAAAAA";
const WARNING = "#FFAA00";
const LABEL_MAX = 60;
const NOTES_MAX = 2_000;
const NO_CHANGES = "No mod changes in this release.";
const FIRST_RELEASE = "first recorded release";
const NOTES_HEADING = "### Additional notes";
const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export interface ChangelogMarkdownSection {
  changelog: ChangelogInput;
  /** Absolute URL the section's entry rows are served under, as `<url>/<projectId>.png` */
  rowImageBaseUrl: string;
}

export interface ChangelogMarkdownInput {
  latest: ChangelogMarkdownSection;
  /** The player's release, only when it is older than the newest one */
  installed: ChangelogMarkdownSection | null;
}

function clip(value: string, max: number): string {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : value;
}

function neutralize(value: string): string {
  return value
    .replace(/[§\\]/g, "")
    .replace(/&(?=[0-9a-fk-or])/g, "＆")
    .replace(/;;+/g, ";");
}

function plain(value: string, max: number): string {
  return neutralize(clip(value.replace(/\s+/g, " ").trim(), max))
    .replace(/%/g, "％")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/[`*_~]/g, "\\$&");
}

function color(hex: string, value: string): string {
  return `%${hex}%${value}%#%`;
}

function linkTarget(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

function entryLine(
  entry: ChangelogEntry,
  section: ChangelogMarkdownSection,
  linked: boolean,
): string {
  const image = `![](${linkTarget(`${section.rowImageBaseUrl}/${entry.projectId}.png`)})`;
  return linked && entry.url ? `[${image}](${linkTarget(entry.url)})` : image;
}

function metaLine({ release, previousVersion }: ChangelogInput): string {
  return [
    release.publishedAt ? DATE_FORMAT.format(release.publishedAt) : null,
    previousVersion === null
      ? FIRST_RELEASE
      : `since ${plain(previousVersion, LABEL_MAX)}`,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

function changeLines(
  section: ChangelogMarkdownSection,
  options: RenderOptions,
): string[] {
  const { changelog } = section;
  if (changelog.previousVersion === null) return [];
  const lines: string[] = [];
  for (const group of CHANGELOG_GROUPS) {
    const entries = changelog[group.key];
    if (entries.length === 0) continue;
    const shown = entries.slice(0, options.cap);
    lines.push(
      "",
      `### ${group.heading} (${entries.length})`,
      ...shown.map((entry) => entryLine(entry, section, options.linked)),
    );
    if (shown.length < entries.length) {
      lines.push(color(MUTED, `…and ${entries.length - shown.length} more`));
    }
  }
  return lines.length > 0 ? lines : ["", NO_CHANGES];
}

function noteLine(line: string): string {
  const escaped = line.replace(/%/g, "％").replace(/[`_~]/g, "\\$&");
  const bold = escaped.split("**").length - 1;
  const single = escaped.replace(/\*\*/g, "").split("*").length - 1;
  return bold % 2 === 0 && single % 2 === 0
    ? escaped
    : escaped.replace(/\*/g, "\\*");
}

function notesLines({ notes }: ChangelogInput): string[] {
  const text = notes ? clip(neutralize(notes).trim(), NOTES_MAX) : "";
  return text ? ["", NOTES_HEADING, ...text.split("\n").map(noteLine)] : [];
}

function render(
  { latest, installed }: ChangelogMarkdownInput,
  options: RenderOptions,
): string {
  const lines = [
    `## What's new in ${plain(latest.changelog.release.label, LABEL_MAX)}`,
  ];
  if (installed !== null) {
    lines.push(
      color(
        WARNING,
        `You're on ${plain(installed.changelog.release.label, LABEL_MAX)}. Update the pack to get these changes.`,
      ),
    );
  }
  lines.push(
    color(MUTED, metaLine(latest.changelog)),
    ...changeLines(latest, options),
    ...notesLines(latest.changelog),
  );
  if (installed !== null) {
    lines.push(
      "",
      "---",
      "",
      `## Your version: ${plain(installed.changelog.release.label, LABEL_MAX)}`,
      color(WARNING, `Outdated · ${metaLine(installed.changelog)}`),
      ...changeLines(installed, options),
      ...notesLines(installed.changelog),
    );
  }
  return `${lines.join("\n")}\n`;
}

function largestGroup({ latest, installed }: ChangelogMarkdownInput): number {
  return Math.max(
    ...[latest, installed].flatMap((section) =>
      section
        ? CHANGELOG_GROUPS.map((group) => section.changelog[group.key].length)
        : [],
    ),
  );
}

/** FancyMenu-flavored changelog Markdown (newest release, then an outdated installed one) with one row image per entry, at most CHANGELOG_ROWS_PER_GROUP_MAX per change group, trimmed to CHANGELOG_MARKDOWN_MAX_LENGTH by dropping links, then lowering that cap. */
export function renderChangelogMarkdown(input: ChangelogMarkdownInput): string {
  const uncapped = Math.min(largestGroup(input), CHANGELOG_ROWS_PER_GROUP_MAX);
  for (const linked of [true, false]) {
    const markdown = render(input, { linked, cap: uncapped });
    if (markdown.length <= CHANGELOG_MARKDOWN_MAX_LENGTH) return markdown;
  }
  let low = 0;
  let high = uncapped;
  while (low < high) {
    const cap = Math.ceil((low + high) / 2);
    if (
      render(input, { linked: false, cap }).length <=
      CHANGELOG_MARKDOWN_MAX_LENGTH
    ) {
      low = cap;
    } else {
      high = cap - 1;
    }
  }
  return render(input, { linked: false, cap: low });
}
