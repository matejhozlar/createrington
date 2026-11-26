import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { ErrorState, LoadingState } from "@/components/query-states";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { Hero } from "@/features/admin/changelog/components/Hero";
import { ReleaseBlock } from "@/features/admin/changelog/components/ReleaseBlock";
import { Toolbar } from "@/features/admin/changelog/components/Toolbar";
import { VersionRail } from "@/features/admin/changelog/components/VersionRail";
import {
  changelogStats,
  filterSections,
  packageNames,
  parseChangelog,
  type ChangelogFilters,
} from "@/features/admin/changelog/parse";

const HEADER = (
  <AdminPageHeader
    trail={[
      { label: "Admin", href: "/admin/dashboard" },
      { label: "Changelog" },
    ]}
  />
);

const INITIAL_FILTERS: ChangelogFilters = {
  packageName: "all",
  bump: "all",
  search: "",
};

export function Changelog() {
  const changelogQuery = useQuery(trpc.admin.changelog.get.queryOptions());
  const content = changelogQuery.data?.content;
  const sections = useMemo(
    () => (content ? parseChangelog(content) : []),
    [content],
  );

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const currentVersion = activeVersion ?? sections[0]?.version ?? null;

  const versionRefs = useRef<Record<string, HTMLElement | null>>({});
  useEffect(() => {
    if (sections.length === 0) return;
    versionRefs.current[window.location.hash.slice(1)]?.scrollIntoView();
  }, [sections]);

  const packages = useMemo(() => packageNames(sections), [sections]);
  const filteredSections = useMemo(
    () => filterSections(sections, filters),
    [sections, filters],
  );

  useEffect(() => {
    if (filteredSections.length === 0) return;
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
  }, [filteredSections]);

  const stats = useMemo(() => changelogStats(sections), [sections]);

  if (changelogQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {HEADER}
        <LoadingState text="Loading changelog..." />
      </div>
    );
  }

  if (changelogQuery.isError) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        {HEADER}
        <ErrorState
          message={`Failed to load the changelog: ${changelogQuery.error.message}`}
          onRetry={() => void changelogQuery.refetch()}
        />
      </div>
    );
  }

  const filtersActive =
    !!filters.search.trim() ||
    filters.packageName !== "all" ||
    filters.bump !== "all";

  return (
    <div className="flex flex-1 flex-col">
      {HEADER}

      <div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-8 sm:px-8">
        <div className="grid gap-12 min-[920px]:grid-cols-[220px_minmax(0,1fr)]">
          <VersionRail
            sections={sections}
            activeVersion={currentVersion}
            onSelect={setActiveVersion}
          />

          <section className="min-w-0">
            {sections.length > 0 && <Hero latest={sections[0]} stats={stats} />}

            <Toolbar
              filters={filters}
              onChange={(patch) =>
                setFilters((current) => ({ ...current, ...patch }))
              }
              packages={packages}
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
                <div className="rounded-2xl border border-dashed border-border-strong bg-card p-16 text-center">
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
