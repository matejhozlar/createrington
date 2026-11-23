import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/query-states";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import { pluralize } from "@/lib/format";
import {
  categoryOptions,
  isHttpUrl,
  projectCategories,
} from "@/features/workshop/format";
import { useFilterParams } from "@/features/workshop/hooks/use-filter-params";
import { usePagination } from "@/features/workshop/hooks/use-pagination";
import { useViewMode } from "@/features/workshop/hooks/use-view-mode";
import { useWorkshopBySlug } from "@/features/workshop/hooks/use-workshop-by-slug";
import {
  FilterSelect,
  FilterToolbar,
} from "@/features/workshop/components/FilterToolbar";
import { ShowMoreButton } from "@/features/workshop/components/ShowMoreButton";
import { DashedBox } from "@/features/workshop/components/WorkshopEmptyState";
import {
  WorkshopPageHeader,
  WorkshopPageShell,
} from "@/features/workshop/components/WorkshopPageShell";
import { PackList } from "./components/PackList";

const FALLBACK_DESCRIPTION =
  "Everything running on the server right now: the base pack plus every mod players have voted in.";

type SourceFilter = "all" | "voted" | "base";

const SOURCE_OPTIONS: Array<{ value: SourceFilter; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "voted", label: "Voted in by players" },
  { value: "base", label: "Base pack" },
];

export function WorkshopPack() {
  const { slug, workshopId, gate } = useWorkshopBySlug("Loading the pack...");

  const { searchParams, setParam, searchInput, setSearchInput, query } =
    useFilterParams();
  const [view, changeView] = useViewMode("workshop-pack-view");

  const category = searchParams.get("category") ?? "all";
  const sourceParam = searchParams.get("source");
  const source: SourceFilter =
    sourceParam === "voted" || sourceParam === "base" ? sourceParam : "all";
  const searching = query.length > 0;

  const { shownCount, showMore } = usePagination(
    `${query}:${source}:${category}`,
  );

  const packQuery = useQuery(
    trpc.user.workshops.getPack.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );

  const page = gate();
  if (!page.data) return page.fallback;

  const { workshop } = page.data;
  const modpack = packQuery.data?.modpack;
  const mods = packQuery.data?.mods ?? [];

  const categories = [
    ...new Set(
      mods.flatMap((mod) => projectCategories(mod.project.categories)),
    ),
  ].sort();

  let visible = [...mods].sort((a, b) =>
    a.project.name.localeCompare(b.project.name),
  );
  if (source === "voted") {
    visible = visible.filter((mod) => mod.origin === "suggestion");
  }
  if (source === "base") {
    visible = visible.filter((mod) => mod.origin !== "suggestion");
  }
  if (category !== "all") {
    visible = visible.filter((mod) =>
      projectCategories(mod.project.categories).includes(category),
    );
  }
  if (searching) {
    visible = visible.filter((mod) =>
      `${mod.project.name} ${mod.project.primaryAuthor ?? ""} ${mod.suggestedByName ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }

  const filtering = searching || source !== "all" || category !== "all";
  const remaining = visible.length - shownCount;

  return (
    <WorkshopPageShell
      backTo={`/workshop/${slug}`}
      backLabel="Back to the workshop"
    >
      <WorkshopPageHeader
        title="The full pack"
        description={modpack?.description ?? FALLBACK_DESCRIPTION}
        workshop={workshop}
        action={
          modpack &&
          isHttpUrl(modpack.curseforgeUrl) && (
            <Button size="lg" asChild>
              <a
                href={modpack.curseforgeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CurseForgeIcon className="size-4" />
                Get the pack on CurseForge
              </a>
            </Button>
          )
        }
      />

      <main className="mt-10 flex flex-col gap-6">
        {packQuery.isLoading ? (
          <LoadingState text="Loading mods..." className="py-16" />
        ) : packQuery.error ? (
          <ErrorState
            bordered
            message={packQuery.error.message}
            onRetry={() => packQuery.refetch()}
          />
        ) : (
          <>
            <h2 className="text-2xl font-semibold">
              {filtering
                ? pluralize(visible.length, "mod")
                : `All ${pluralize(mods.length, "mod")}`}
            </h2>

            <FilterToolbar
              search={searchInput}
              onSearchChange={setSearchInput}
              placeholder="Search the pack..."
              view={view}
              onViewChange={changeView}
            >
              <FilterSelect
                value={source}
                onValueChange={(value) => setParam("source", value, "all")}
                options={SOURCE_OPTIONS}
                className="w-full sm:w-44"
              />
              <FilterSelect
                value={category}
                onValueChange={(value) => setParam("category", value, "all")}
                options={categoryOptions(categories)}
                className="w-full sm:w-[150px]"
              />
            </FilterToolbar>

            {visible.length === 0 ? (
              <DashedBox>
                {filtering
                  ? "No mods match your search."
                  : "Nothing in the pack yet."}
              </DashedBox>
            ) : (
              <PackList mods={visible.slice(0, shownCount)} view={view} />
            )}

            <ShowMoreButton
              remaining={remaining}
              onClick={showMore}
              className="-mt-1"
            />
          </>
        )}
      </main>
    </WorkshopPageShell>
  );
}
