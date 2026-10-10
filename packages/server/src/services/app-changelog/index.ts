import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "@/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const levels = config.envMode.isProd ? 4 : 5;
const ROOT = path.resolve(__dirname, ...Array(levels).fill(".."));
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

export const CHANGE_KINDS = [
  "add",
  "fix",
  "refactor",
  "remove",
  "security",
  "chore",
  "other",
] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export interface ReleaseSummary {
  date: string;
  counts: Record<ChangeKind, number>;
}

const RELEASE_HEADING = /^## v(\d+\.\d+\.\d+)\s+\((.+)\)\s*$/;
const ENTRY = /^- (?:\[([a-z]+)\]\s*)?\S/i;

function isChangeKind(tag: string): tag is ChangeKind {
  return (CHANGE_KINDS as readonly string[]).includes(tag);
}

export async function readAppChangelog(): Promise<string> {
  return fs.readFile(CHANGELOG_PATH, "utf-8");
}

export function summarizeRelease(
  changelog: string,
  version: string,
): ReleaseSummary | null {
  let summary: ReleaseSummary | null = null;

  for (const line of changelog.split(/\r?\n/)) {
    const heading = line.match(RELEASE_HEADING);
    if (heading) {
      if (summary) break;
      if (heading[1] === version) {
        summary = {
          date: heading[2],
          counts: {
            add: 0,
            fix: 0,
            refactor: 0,
            remove: 0,
            security: 0,
            chore: 0,
            other: 0,
          },
        };
      }
      continue;
    }

    if (!summary) continue;

    const entry = line.match(ENTRY);
    if (!entry) continue;

    const tag = entry[1]?.toLowerCase() ?? "other";
    summary.counts[isChangeKind(tag) ? tag : "other"]++;
  }

  return summary;
}
