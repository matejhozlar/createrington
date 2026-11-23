export const CHANGE_KINDS = [
  "add",
  "fix",
  "refactor",
  "remove",
  "security",
  "chore",
  "tweak",
  "change",
] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type Bump = "major" | "minor" | "patch";

export type RangeBump = Bump | "new";

export const BUMP_FILTERS = [
  { value: "all", label: "All types" },
  { value: "minor", label: "Minor" },
  { value: "patch", label: "Patch" },
] as const;

export type BumpFilter = (typeof BUMP_FILTERS)[number]["value"];

export interface PackageEntry {
  name: string;
  versionRange: string;
  items: string[];
}

export interface ChangelogSection {
  version: string;
  date: string;
  entries: PackageEntry[];
}

export interface ChangelogFilters {
  packageName: string;
  bump: BumpFilter;
  search: string;
}

export interface ChangelogStats {
  total: number;
  adds: number;
  fixes: number;
  releases: number;
}

const TAG_PREFIX = /^\s*\[([a-z]+)\]\s*/i;

function isChangeKind(tag: string): tag is ChangeKind {
  return (CHANGE_KINDS as readonly string[]).includes(tag);
}

function classifyByVerb(text: string): ChangeKind {
  const t = text.trim().toLowerCase();
  if (t.startsWith("fix")) return "fix";
  if (t.startsWith("add")) return "add";
  if (/^(remove|drop|delete)/.test(t)) return "remove";
  if (
    /^(refactor|modulari[sz]e|extract|split|consolidate|move|migrate|replace|switch|unify|standardi[sz]e)/.test(
      t,
    )
  )
    return "refactor";
  if (/^(polish|redesign|restyle|update|rework|animated|clean|refine)/.test(t))
    return "tweak";
  if (/^(harden|security|patch|reject|validate|restrict|tighten|guard)/.test(t))
    return "security";
  return "change";
}

export function classifyEntry(raw: string): { kind: ChangeKind; text: string } {
  const m = raw.match(TAG_PREFIX);
  if (m) {
    const tag = m[1].toLowerCase();
    const stripped = raw.replace(TAG_PREFIX, "");
    if (isChangeKind(tag)) {
      return { kind: tag, text: stripped };
    }
    return { kind: classifyByVerb(stripped), text: stripped };
  }
  return { kind: classifyByVerb(raw), text: raw };
}

export function rangeBump(versionRange: string): RangeBump {
  if (!versionRange) return "patch";
  if (versionRange.toLowerCase().includes("new")) return "new";
  const m = versionRange.match(
    /(\d+)\.(\d+)\.(\d+)\s*(?:→|->)\s*(\d+)\.(\d+)\.(\d+)/,
  );
  if (!m) return "patch";
  const [, a1, a2, , b1, b2] = m;
  if (a1 !== b1) return "major";
  if (a2 !== b2) return "minor";
  return "patch";
}

export function versionBump(version: string): Bump {
  const m = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return "patch";
  const [, , minor, patch] = m;
  if (patch !== "0") return "patch";
  if (minor !== "0") return "minor";
  return "major";
}

export function shortPkg(name: string): string {
  if (name.startsWith("@createrington/"))
    return name.slice("@createrington/".length);
  return name.toLowerCase();
}

export function parseChangelog(raw: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let currentPkg: PackageEntry | null = null;

  for (const line of raw.split("\n")) {
    const headingMatch = line.match(/^## (v[\d.]+)\s+\((.+)\)$/);
    if (headingMatch) {
      current = {
        version: headingMatch[1],
        date: headingMatch[2],
        entries: [],
      };
      sections.push(current);
      currentPkg = null;
      continue;
    }

    const pkgMatch = line.match(/^### (.+?)(?:\s+\((.+)\))?$/);
    if (pkgMatch && current) {
      currentPkg = {
        name: pkgMatch[1],
        versionRange: pkgMatch[2] ?? "",
        items: [],
      };
      current.entries.push(currentPkg);
      continue;
    }

    const itemMatch = line.match(/^- (.+)$/);
    if (itemMatch && currentPkg) {
      currentPkg.items.push(itemMatch[1]);
    }
  }

  return sections;
}

export function packageNames(sections: ChangelogSection[]): string[] {
  const set = new Set<string>();
  sections.forEach((s) => s.entries.forEach((e) => set.add(e.name)));
  return Array.from(set);
}

export function filterSections(
  sections: ChangelogSection[],
  filters: ChangelogFilters,
): ChangelogSection[] {
  const q = filters.search.trim() ? filters.search.toLowerCase() : null;
  return sections
    .map((s) => {
      let entries = s.entries;
      if (filters.packageName !== "all") {
        entries = entries.filter((e) => e.name === filters.packageName);
      }
      if (q) {
        entries = entries
          .map((e) => ({
            ...e,
            items: e.items.filter((i) => i.toLowerCase().includes(q)),
          }))
          .filter((e) => e.items.length > 0);
      }
      return { ...s, entries };
    })
    .filter((s) => {
      if (s.entries.length === 0) return false;
      if (filters.bump === "all") return true;
      return versionBump(s.version) === filters.bump;
    });
}

export function changelogStats(sections: ChangelogSection[]): ChangelogStats {
  let total = 0;
  let adds = 0;
  let fixes = 0;
  sections.forEach((s) =>
    s.entries.forEach((e) =>
      e.items.forEach((item) => {
        total++;
        const { kind } = classifyEntry(item);
        if (kind === "add") adds++;
        else if (kind === "fix") fixes++;
      }),
    ),
  );
  return { total, adds, fixes, releases: sections.length };
}
