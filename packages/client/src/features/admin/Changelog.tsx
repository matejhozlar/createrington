import { trpc } from "@/lib/trpc";
import { Loading } from "@/components/loading-spinner";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Filter, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Kind =
  | "add"
  | "fix"
  | "refactor"
  | "remove"
  | "security"
  | "chore"
  | "tweak"
  | "change";

type Bump = "major" | "minor" | "patch";
type RangeBump = Bump | "new";

interface PackageEntry {
  name: string;
  versionRange: string;
  items: string[];
}

interface ChangelogSection {
  version: string;
  date: string;
  entries: PackageEntry[];
}

interface ClassifiedEntry {
  kind: Kind;
  text: string;
}

const TAG_META: Record<Kind, { label: string; color: string }> = {
  add: { label: "New", color: "var(--c-add)" },
  fix: { label: "Fix", color: "var(--c-fix)" },
  refactor: { label: "Refactor", color: "var(--c-refactor)" },
  remove: { label: "Remove", color: "var(--c-remove)" },
  security: { label: "Security", color: "var(--c-security)" },
  chore: { label: "Chore", color: "var(--c-chore)" },
  tweak: { label: "Polish", color: "var(--c-tweak)" },
  change: { label: "Change", color: "var(--c-change)" },
};

const TAG_PREFIX = /^\s*\[([a-z]+)\]\s*/i;

function classifyByVerb(text: string): Kind {
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

function classifyEntry(raw: string): ClassifiedEntry {
  const m = raw.match(TAG_PREFIX);
  if (m) {
    const tag = m[1].toLowerCase();
    const stripped = raw.replace(TAG_PREFIX, "");
    if (tag in TAG_META) {
      return { kind: tag as Kind, text: stripped };
    }
    return { kind: classifyByVerb(stripped), text: stripped };
  }
  return { kind: classifyByVerb(raw), text: raw };
}

function rangeBump(versionRange: string): RangeBump {
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

function versionBump(version: string): Bump {
  const m = version.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return "patch";
  const [, , minor, patch] = m;
  if (patch !== "0") return "patch";
  if (minor !== "0") return "minor";
  return "major";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const diff = Math.round(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  if (diff < 365) return `${Math.floor(diff / 30)}mo ago`;
  return `${Math.floor(diff / 365)}y ago`;
}

function shortPkg(name: string): string {
  if (name.startsWith("@createrington/"))
    return name.slice("@createrington/".length);
  return name.toLowerCase();
}

function parseChangelog(raw: string): ChangelogSection[] {
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

function EntryText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code
            key={i}
            className="whitespace-nowrap rounded-[5px] border border-border bg-white/[0.06] px-1.5 py-px font-mono text-[0.86em] text-foreground"
          >
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function VerbTag({ kind }: { kind: Kind }) {
  const meta = TAG_META[kind];
  return (
    <span
      className="mt-0.5 inline-flex h-5 min-w-16 shrink-0 items-center justify-center rounded-[5px] border px-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em]"
      style={{
        color: meta.color,
        background: `oklch(from ${meta.color} l c h / 0.1)`,
        borderColor: `oklch(from ${meta.color} l c h / 0.25)`,
      }}
    >
      {meta.label}
    </span>
  );
}

const HEADER = (
  <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Changelog</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </header>
);

export function Changelog() {
  const { data, isLoading } = trpc.admin.changelog.get.useQuery();
  const content = data?.content;
  const sections = useMemo(
    () => (content ? parseChangelog(content) : []),
    [content],
  );

  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [bumpFilter, setBumpFilter] = useState<"all" | "minor" | "patch">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [activeVersion, setActiveVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!activeVersion && sections.length > 0) {
      setActiveVersion(sections[0].version);
    }
  }, [sections, activeVersion]);

  const versionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
          const v = visible[0].target.getAttribute("data-version");
          if (v) setActiveVersion(v);
        }
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    Object.values(versionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [sections]);

  const allPackages = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => s.entries.forEach((e) => set.add(e.name)));
    return Array.from(set);
  }, [sections]);

  const filteredSections = useMemo(() => {
    return sections
      .map((s) => {
        let entries = s.entries;
        if (packageFilter !== "all") {
          entries = entries.filter((e) => e.name === packageFilter);
        }
        if (search.trim()) {
          const q = search.toLowerCase();
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
        if (bumpFilter === "all") return true;
        return versionBump(s.version) === bumpFilter;
      });
  }, [sections, packageFilter, bumpFilter, search]);

  const stats = useMemo(() => {
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
  }, [sections]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {HEADER}
        <div className="flex flex-1 items-center justify-center">
          <Loading size="medium" text="Loading changelog..." />
        </div>
      </div>
    );
  }

  const filtersActive =
    !!search.trim() || packageFilter !== "all" || bumpFilter !== "all";

  return (
    <div className="flex flex-1 flex-col">
      {HEADER}

      <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-8 sm:px-8">
        <div className="grid gap-12 min-[920px]:grid-cols-[220px_minmax(0,1fr)]">
          <VersionRail
            sections={sections}
            activeVersion={activeVersion}
            onSelect={setActiveVersion}
          />

          <section className="min-w-0">
            {sections.length > 0 && <Hero latest={sections[0]} stats={stats} />}

            <Toolbar
              search={search}
              onSearch={setSearch}
              allPackages={allPackages}
              packageFilter={packageFilter}
              onPackageFilter={setPackageFilter}
              bumpFilter={bumpFilter}
              onBumpFilter={setBumpFilter}
            />

            <div className="flex flex-col gap-7">
              {filteredSections.map((section, idx) => (
                <ReleaseBlock
                  key={section.version}
                  section={section}
                  isLatest={idx === 0 && !filtersActive}
                  refSetter={(el) => {
                    versionRefs.current[section.version] = el;
                  }}
                />
              ))}

              {filteredSections.length === 0 && sections.length > 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-card p-16 text-center">
                  <div className="mb-3 text-4xl opacity-40">⚙</div>
                  <div className="mb-1 font-semibold">No matching changes</div>
                  <div className="text-sm text-muted-foreground">
                    Try clearing the search or package filter.
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function VersionRail({
  sections,
  activeVersion,
  onSelect,
}: {
  sections: ChangelogSection[];
  activeVersion: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <aside className="hidden min-[920px]:block">
      <div className="sticky top-6">
        <div className="mb-3 px-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Releases
        </div>
        <ul className="rail-scroll relative m-0 max-h-[calc(100vh-200px)] list-none overflow-y-auto p-0 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-[linear-gradient(to_bottom,transparent_0%,var(--border-strong)_8%,var(--border-strong)_92%,transparent_100%)] before:content-['']">
          {sections.map((s) => {
            const isActive = activeVersion === s.version;
            const bump = versionBump(s.version);
            return (
              <li key={s.version}>
                <a
                  href={`#${s.version}`}
                  onClick={() => onSelect(s.version)}
                  className={cn(
                    "relative grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-lg px-2 py-[7px] pl-2 pr-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground",
                    isActive && "bg-white/[0.05] text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 ml-[5px] block size-[9px] rounded-full border-2 border-background",
                      bump === "major" &&
                        "bg-primary shadow-[0_0_0_1px_var(--primary),0_0_12px_var(--primary-glow)]",
                      bump === "minor" &&
                        "bg-[var(--c-add)] shadow-[0_0_0_1px_var(--c-add)]",
                      bump === "patch" &&
                        "bg-secondary shadow-[0_0_0_1px_var(--border-strong)]",
                      isActive &&
                        "shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-glow)]",
                    )}
                  />
                  <span
                    className={cn(
                      "font-mono text-xs font-medium",
                      isActive && "text-primary",
                    )}
                  >
                    {s.version}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {relativeDate(s.date)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex gap-3 border-t border-border px-3 pt-4">
          <a
            href="#"
            className="font-mono text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            RSS feed
          </a>
          <a
            href="#"
            className="font-mono text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            JSON
          </a>
        </div>
      </div>
    </aside>
  );
}

function Hero({
  latest,
  stats,
}: {
  latest: ChangelogSection;
  stats: { total: number; adds: number; fixes: number; releases: number };
}) {
  return (
    <div
      className="relative mb-7 overflow-hidden rounded-[18px] border border-[var(--border-strong)] p-9 pb-8 shadow-[0_1px_0_oklch(1_0_0_/_0.04)_inset,0_24px_48px_-24px_oklch(0_0_0_/_0.6)]"
      style={{
        background:
          "radial-gradient(ellipse 70% 100% at 100% 0%, oklch(0.26 0.014 285) 0%, transparent 65%), linear-gradient(180deg, oklch(0.215 0.011 285) 0%, oklch(0.185 0.009 285) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 w-[3px] opacity-85"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--primary) 30%, var(--primary) 70%, transparent 100%)",
        }}
      />
      <div className="relative">
        <div className="mb-[18px] font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
          Latest release · {formatDate(latest.date)}
        </div>
        <h1 className="m-0 mb-3 flex items-baseline gap-4 font-semibold tracking-[-0.025em]">
          <span className="font-mono text-[46px] font-semibold leading-none tracking-[-0.02em] text-primary">
            {latest.version}
          </span>
          <span className="h-7 w-px bg-[var(--border-strong)]" />
          <span className="text-2xl font-medium text-foreground">
            Workshop log
          </span>
        </h1>
        <p
          className="m-0 max-w-[60ch] text-[14.5px] text-muted-foreground"
          style={{ textWrap: "pretty" }}
        >
          A running record of every gear we&apos;ve added, every belt we&apos;ve
          tightened, and every leak we&apos;ve sealed across the Createrington
          platform.
        </p>
        <div className="mt-7 flex flex-wrap gap-8 border-t border-dashed border-border pt-[22px]">
          <Stat n={stats.releases} label="releases" />
          <Stat n={stats.total} label="changes" />
          <Stat n={stats.adds} label="new things" tone="add" />
          <Stat n={stats.fixes} label="fixes" tone="fix" />
        </div>
        <div className="mt-[22px] flex flex-wrap items-center gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            In this release
          </div>
          <div className="flex flex-wrap gap-2">
            {latest.entries.map((e) => (
              <span
                key={e.name}
                className="inline-block whitespace-nowrap rounded-full border border-border bg-white/[0.04] px-2.5 py-[5px] text-xs"
              >
                <span className="font-medium text-foreground">
                  {shortPkg(e.name)}
                </span>
                {e.versionRange && (
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                    {e.versionRange}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: "add" | "fix";
}) {
  return (
    <div>
      <div
        className={cn(
          "font-mono text-[22px] font-semibold tabular-nums tracking-[-0.01em]",
          tone === "add" && "text-[var(--c-add)]",
          tone === "fix" && "text-[var(--c-fix)]",
          !tone && "text-foreground",
        )}
      >
        {n}
      </div>
      <div className="mt-0.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Toolbar({
  search,
  onSearch,
  allPackages,
  packageFilter,
  onPackageFilter,
  bumpFilter,
  onBumpFilter,
}: {
  search: string;
  onSearch: (v: string) => void;
  allPackages: string[];
  packageFilter: string;
  onPackageFilter: (v: string) => void;
  bumpFilter: "all" | "minor" | "patch";
  onBumpFilter: (v: "all" | "minor" | "patch") => void;
}) {
  const activeCount =
    (search.trim() ? 1 : 0) +
    (packageFilter !== "all" ? 1 : 0) +
    (bumpFilter !== "all" ? 1 : 0);

  return (
    <Card className="mb-7 gap-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="size-4 text-muted-foreground" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
              {activeCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1 sm:min-w-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search the changelog..."
              className="pl-9"
            />
          </div>

          <Select value={packageFilter} onValueChange={onPackageFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Package" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All packages</SelectItem>
              {allPackages.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={bumpFilter}
            onValueChange={(v) => onBumpFilter(v as "all" | "minor" | "patch")}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="patch">Patch</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseBlock({
  section,
  isLatest,
  refSetter,
}: {
  section: ChangelogSection;
  isLatest: boolean;
  refSetter: (el: HTMLElement | null) => void;
}) {
  const bump = versionBump(section.version);
  const totalChanges = section.entries.reduce((s, e) => s + e.items.length, 0);

  return (
    <article
      ref={refSetter}
      id={section.version}
      data-version={section.version}
      className={cn(
        "relative scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-[var(--border-strong)]",
        isLatest &&
          "border-[var(--primary-dim)] shadow-[0_0_0_1px_var(--primary-glow),0_24px_48px_-32px_var(--primary-glow)]",
      )}
    >
      {isLatest && (
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse 60% 30% at 0% 0%, var(--primary-glow), transparent 60%)",
          }}
        />
      )}

      <header
        className="relative flex flex-wrap items-center gap-4 border-b border-border px-5 py-[18px]"
        style={{
          background:
            "linear-gradient(180deg, oklch(1 0 0 / 0.02), transparent), var(--card)",
        }}
      >
        <div className="flex flex-1 items-center gap-[18px]">
          <div
            className={cn(
              "flex w-[78px] shrink-0 flex-col items-center rounded-[10px] border border-[var(--border-strong)] px-2 pb-2 pt-2.5",
              bump === "major" && "border-[var(--primary-dim)]",
              bump === "minor" &&
                "border-[oklch(from_var(--c-add)_l_c_h_/_0.4)]",
            )}
            style={{
              background:
                "linear-gradient(180deg, oklch(1 0 0 / 0.04), oklch(0 0 0 / 0.05))",
            }}
          >
            <div
              className={cn(
                "font-mono text-sm font-semibold leading-tight tracking-[-0.01em]",
                bump === "major" ? "text-primary" : "text-foreground",
              )}
            >
              {section.version}
            </div>
            <div
              className={cn(
                "mt-1 w-full border-t border-border pt-1 text-center font-mono text-[9.5px] uppercase tracking-[0.1em]",
                bump === "major" && "text-primary",
                bump === "minor" && "text-[var(--c-add)]",
                bump === "patch" && "text-muted-foreground",
              )}
            >
              {bump}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[13px] font-medium text-foreground">
              {formatDate(section.date)}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {relativeDate(section.date)}
              </span>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {totalChanges} {totalChanges === 1 ? "change" : "changes"} across{" "}
              {section.entries.length}{" "}
              {section.entries.length === 1 ? "package" : "packages"}
            </div>
          </div>
        </div>
        {isLatest && (
          <span
            className="inline-flex items-center rounded-full border border-[var(--primary-dim)] px-2.5 py-[5px] font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-primary"
            style={{ background: "var(--primary-glow)" }}
          >
            latest
          </span>
        )}
      </header>

      <div className="relative flex flex-col gap-1 px-5 pb-5 pt-2">
        {section.entries.map((entry) => (
          <PackageBlock key={entry.name} entry={entry} />
        ))}
      </div>
    </article>
  );
}

function PackageBlock({ entry }: { entry: PackageEntry }) {
  const bump = rangeBump(entry.versionRange);
  return (
    <section className="border-b border-dashed border-border py-4 last:border-b-0 last:pb-1">
      <header className="mb-3 flex items-center gap-3 pb-0.5">
        <div className="flex flex-1 items-center gap-2.5">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          <h3 className="m-0 font-mono text-[13px] font-medium tracking-[-0.005em] text-foreground">
            {entry.name}
          </h3>
          {entry.versionRange && (
            <span
              className={cn(
                "rounded-[5px] border border-border bg-white/[0.04] px-[7px] py-px font-mono text-[11px] text-muted-foreground",
                bump === "major" && "border-[var(--primary-dim)] text-primary",
                (bump === "minor" || bump === "new") &&
                  "border-[oklch(from_var(--c-add)_l_c_h_/_0.3)] text-[var(--c-add)]",
              )}
            >
              {entry.versionRange}
            </span>
          )}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {entry.items.length} {entry.items.length === 1 ? "change" : "changes"}
        </span>
      </header>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {entry.items.map((raw, i) => {
          const { kind, text } = classifyEntry(raw);
          return (
            <li
              key={i}
              className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-lg px-2 py-2 text-[13.5px] leading-[1.55] text-muted-foreground transition-colors hover:bg-white/[0.025] hover:text-foreground"
            >
              <VerbTag kind={kind} />
              <span style={{ textWrap: "pretty" }}>
                <EntryText text={text} />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
