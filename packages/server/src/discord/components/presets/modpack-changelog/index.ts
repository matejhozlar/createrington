import { escapeMarkdown } from "discord.js";
import {
  actionRow,
  container,
  linkButton,
  measureComponentsV2,
  mediaGallery,
  section,
  separator,
  text,
  thumbnail,
} from "../../component-builder";
import { ComponentColors } from "../../colors";
import { discordTimestamp, pluralize } from "@/utils/format";
import {
  CURSEFORGE_CLASSES,
  curseforgeClassLabel,
} from "@createrington/shared/workshop";
import {
  COMPONENTS_V2_MAX_COMPONENTS,
  COMPONENTS_V2_MAX_TEXT,
  type ComponentContainer,
  type ComponentsData,
} from "@createrington/shared/api/embed";

export interface ChangelogRelease {
  title: string;
  label: string;
  titleImageUrl: string | null;
  minecraftVersion: string | null;
  modLoader: string | null;
  modCount: number;
  publishedAt: Date | null;
  downloadUrl: string | null;
}

export interface ChangelogEntry {
  name: string;
  url: string | null;
  thumbnailUrl: string | null;
  classId: number;
  disabled: boolean;
  label: string;
  previousLabel: string | null;
}

export interface ChangelogInput {
  release: ChangelogRelease;
  previousVersion: string | null;
  added: ChangelogEntry[];
  updated: ChangelogEntry[];
  removed: ChangelogEntry[];
  unchanged: number;
}

type ChangeGroup = "added" | "updated" | "removed";
type Child = ComponentContainer["components"][number];

const GROUPS: Array<{ key: ChangeGroup; heading: string }> = [
  { key: "added", heading: "Added" },
  { key: "updated", heading: "Updated" },
  { key: "removed", heading: "Removed" },
];

const NAME_MAX = 80;
const LABEL_MAX = 60;
const TITLE_MAX = 200;
const DOWNLOAD_LABEL = "Download on CurseForge";
const NO_CHANGES = "No mod changes in this release.";

export const CHANGELOG_SPACER_IMAGE_URL =
  "https://assets.createrington.com/changelog-spacer.png";

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function code(value: string): string {
  return `\`${clip(value, LABEL_MAX).replace(/`/g, "'")}\``;
}

function entryBody(entry: ChangelogEntry, group: ChangeGroup): string {
  const name = escapeMarkdown(clip(entry.name, NAME_MAX));
  const title = entry.url
    ? `**[${name}](${entry.url.replace(/\)/g, "%29")})**`
    : `**${name}**`;
  const tags: string[] = [];
  if (entry.classId !== CURSEFORGE_CLASSES.mods) {
    tags.push(curseforgeClassLabel(entry.classId));
  }
  if (entry.disabled) tags.push("disabled");
  const head = tags.length > 0 ? `${title} · ${tags.join(" · ")}` : title;
  const version =
    group === "updated" && entry.previousLabel !== null
      ? `${code(entry.previousLabel)} → ${code(entry.label)}`
      : code(entry.label);
  return `${head}\n${version}`;
}

function entryNode(entry: ChangelogEntry, group: ChangeGroup): Child {
  const body = entryBody(entry, group);
  if (entry.thumbnailUrl) return section([body], thumbnail(entry.thumbnailUrl));
  if (entry.url) return section([body], linkButton("CurseForge", entry.url));
  return text(body);
}

function headingNode(heading: string, count: number): Child {
  return text(`### ${heading} (${count})`);
}

function headerNodes(input: ChangelogInput): Child[] {
  const { release } = input;
  const meta = [
    release.minecraftVersion ? `Minecraft ${release.minecraftVersion}` : null,
    release.modLoader,
    `${release.modCount} ${pluralize(release.modCount, "mod")}`,
    release.publishedAt
      ? `Published ${discordTimestamp(release.publishedAt, "R")}`
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");
  const counts = [
    `**${input.added.length} added**`,
    `**${input.updated.length} updated**`,
    `**${input.removed.length} removed**`,
    `${input.unchanged} unchanged`,
  ].join(" · ");
  const summary = input.previousVersion
    ? `Changes since ${escapeMarkdown(clip(input.previousVersion, LABEL_MAX))}: ${counts}`
    : counts;
  const title = clip(release.title, TITLE_MAX);
  if (release.titleImageUrl) {
    return [
      mediaGallery([{ url: release.titleImageUrl, description: title }]),
      text(
        [
          `**${escapeMarkdown(clip(release.label, LABEL_MAX))}**`,
          `-# ${meta}`,
          summary,
        ].join("\n"),
      ),
    ];
  }
  return [
    text([`## ${escapeMarkdown(title)}`, `-# ${meta}`, summary].join("\n")),
  ];
}

function footer(release: ChangelogRelease): Child[] {
  if (!release.downloadUrl) return [];
  return [
    separator(),
    actionRow([linkButton(DOWNLOAD_LABEL, release.downloadUrl)]),
  ];
}

function opening(input: ChangelogInput, first: boolean): Child[] {
  return first
    ? [...headerNodes(input), separator()]
    : [mediaGallery([{ url: CHANGELOG_SPACER_IMAGE_URL }])];
}

function fits(open: Child[], children: Child[]): boolean {
  const probe = container([
    ...open,
    ...children,
    separator(),
    actionRow([linkButton(DOWNLOAD_LABEL, "https://www.curseforge.com")]),
  ]);
  const { count, text: length } = measureComponentsV2([probe]);
  return (
    count <= COMPONENTS_V2_MAX_COMPONENTS && length <= COMPONENTS_V2_MAX_TEXT
  );
}

function pack(input: ChangelogInput): Child[][] {
  const openings = { first: opening(input, true), rest: opening(input, false) };
  const parts: Child[][] = [];
  let current: Child[] = [];

  for (const group of GROUPS) {
    const entries = input[group.key];
    if (entries.length === 0) continue;
    let opened = false;
    for (const entry of entries) {
      const node = entryNode(entry, group.key);
      const pending: Child[] = opened
        ? [node]
        : [headingNode(group.heading, entries.length), node];
      const open = parts.length === 0 ? openings.first : openings.rest;
      if (fits(open, [...current, ...pending])) {
        current.push(...pending);
        opened = true;
        continue;
      }
      if (current.length > 0) parts.push(current);
      current = pending;
      opened = true;
    }
  }

  if (current.length > 0 || parts.length === 0) {
    parts.push(current.length > 0 ? current : [text(NO_CHANGES)]);
  }
  return parts;
}

/** Components V2 renderings of a modpack release changelog for the changelog channel. */
export const ModpackChangelogComponentPresets = {
  /**
   * One message per chunk of the diff, each within Discord's component and
   * text ceilings. Only the first opens with the release header; the others
   * open with a transparent full-width image, without which Discord would
   * shrink them to their content instead of matching the first one's width.
   */
  release(input: ChangelogInput): ComponentsData[] {
    const chunks = pack(input);
    return chunks.map((children, index) => {
      const last = index === chunks.length - 1;
      return {
        components: [
          container(
            [
              ...opening(input, index === 0),
              ...children,
              ...(last ? footer(input.release) : []),
            ],
            { accentColor: ComponentColors.Info },
          ),
        ],
      };
    });
  },
};
