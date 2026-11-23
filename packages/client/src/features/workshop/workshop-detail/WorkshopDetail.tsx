import { useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { trpc, queryClient } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useToastActions } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/query-states";
import { categoryOptions, projectCategories } from "@/features/workshop/format";
import { useFilterParams } from "@/features/workshop/hooks/use-filter-params";
import { usePagination } from "@/features/workshop/hooks/use-pagination";
import { useViewMode } from "@/features/workshop/hooks/use-view-mode";
import { useWorkshopBySlug } from "@/features/workshop/hooks/use-workshop-by-slug";
import {
  FilterSelect,
  FilterToolbar,
} from "@/features/workshop/components/FilterToolbar";
import { PackStrip } from "@/features/workshop/components/PackStrip";
import { ShowMoreButton } from "@/features/workshop/components/ShowMoreButton";
import { DashedBox } from "@/features/workshop/components/WorkshopEmptyState";
import {
  WorkshopPageHeader,
  WorkshopPageShell,
} from "@/features/workshop/components/WorkshopPageShell";
import {
  Leaderboard,
  type RaceItem,
  type RaceMod,
} from "./components/Leaderboard";
import { ModDetailDialog } from "./components/ModDetailDialog";
import { PackSearchResults } from "./components/PackSearchResults";
import { useQuery, useMutation } from "@tanstack/react-query";

type SortMode = "top" | "new" | "votes";

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "top", label: "Most upvoted" },
  { value: "new", label: "Newest first" },
  { value: "votes", label: "My votes" },
];

function byRace(a: RaceMod, b: RaceMod): number {
  return (
    b.upvoteCount - a.upvoteCount ||
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.id - b.id
  );
}

export function WorkshopDetail() {
  const { slug, workshopId, gate } = useWorkshopBySlug("Loading workshop...");
  const { user } = useAuth();
  const toast = useToastActions();

  const navigate = useNavigate();
  const pushedModRef = useRef(false);
  const { searchParams, setParam, searchInput, setSearchInput, query } =
    useFilterParams();
  const [view, changeView] = useViewMode("workshop-detail-view");

  const category = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort");
  const sortMode: SortMode =
    sortParam === "new" || sortParam === "votes" ? sortParam : "top";
  const modParam = searchParams.get("mod");
  const openModId =
    modParam && /^\d+$/.test(modParam) ? Number(modParam) : null;
  const searching = query.length > 0;

  const { shownCount, showMore } = usePagination(
    `${query}:${category}:${sortMode}`,
  );

  const myUpvotesQuery = useQuery(
    trpc.user.workshops.myUpvotes.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );
  const rejectedQuery = useQuery(
    trpc.user.workshops.listRejected.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined && searching },
    ),
  );
  const packQuery = useQuery(
    trpc.user.workshops.getPack.queryOptions(
      { workshopId: workshopId! },
      { enabled: workshopId !== undefined },
    ),
  );

  const upvoteMutation = useMutation(
    trpc.user.workshops.upvoteMod.mutationOptions({
      onMutate: async ({ workshopModId }) => {
        if (!slug || workshopId === undefined) return;
        await Promise.all([
          queryClient.cancelQueries(
            trpc.user.workshops.get.queryFilter({ slug }),
          ),
          queryClient.cancelQueries(
            trpc.user.workshops.myUpvotes.queryFilter({ workshopId }),
          ),
        ]);
        const previousGet = queryClient.getQueryData(
          trpc.user.workshops.get.queryKey({ slug }),
        );
        const previousUpvotes = queryClient.getQueryData(
          trpc.user.workshops.myUpvotes.queryKey({
            workshopId,
          }),
        );
        const removing =
          previousUpvotes?.modIds.includes(workshopModId) ?? false;
        queryClient.setQueryData(
          trpc.user.workshops.get.queryKey({ slug }),
          (data) =>
            data && {
              ...data,
              mods: data.mods.map((mod) =>
                mod.id === workshopModId
                  ? {
                      ...mod,
                      upvoteCount: Math.max(
                        0,
                        mod.upvoteCount + (removing ? -1 : 1),
                      ),
                    }
                  : mod,
              ),
            },
        );
        queryClient.setQueryData(
          trpc.user.workshops.myUpvotes.queryKey({ workshopId }),
          (data) =>
            data && {
              ...data,
              modIds: removing
                ? data.modIds.filter((id) => id !== workshopModId)
                : [...data.modIds, workshopModId],
              votesRemaining: removing
                ? Math.min(data.maxUpvotes, data.votesRemaining + 1)
                : Math.max(0, data.votesRemaining - 1),
            },
        );
        return { previousGet, previousUpvotes };
      },
      onError: (error, _input, context) => {
        if (slug && context?.previousGet) {
          queryClient.setQueryData(
            trpc.user.workshops.get.queryKey({ slug }),
            context.previousGet,
          );
        }
        if (workshopId !== undefined && context?.previousUpvotes) {
          queryClient.setQueryData(
            trpc.user.workshops.myUpvotes.queryKey({ workshopId }),
            context.previousUpvotes,
          );
        }
        toast.error(error.message);
      },
      onSettled: () => {
        if (slug)
          void queryClient.invalidateQueries(
            trpc.user.workshops.get.queryFilter({ slug }),
          );
        if (workshopId !== undefined) {
          void queryClient.invalidateQueries(
            trpc.user.workshops.myUpvotes.queryFilter({ workshopId }),
          );
        }
        void queryClient.invalidateQueries(
          trpc.user.workshops.list.pathFilter(),
        );
      },
    }),
  );

  const page = gate();
  const allMods = page.data?.mods;
  const upvotedModIds = myUpvotesQuery.data?.modIds;
  const rejectedMods = rejectedQuery.data;
  const packRows = packQuery.data?.mods;

  const race = useMemo(() => {
    const mods = allMods ?? [];
    const ranked = mods.filter((mod) => mod.status === "pending").sort(byRace);
    return {
      ranked,
      rankById: new Map(ranked.map((mod, index) => [mod.id, index + 1])),
      maxRaceCount: Math.max(1, ...ranked.map((mod) => mod.upvoteCount)),
      categories: [
        ...new Set(
          mods.flatMap((mod) => projectCategories(mod.project.categories)),
        ),
      ].sort(),
    };
  }, [allMods]);

  const upvotedIds = useMemo(
    () => new Set(upvotedModIds ?? []),
    [upvotedModIds],
  );

  const visible = useMemo(() => {
    let result: RaceMod[] = searching
      ? [...(allMods ?? []), ...(rejectedMods ?? [])].sort(byRace)
      : race.ranked;
    if (sortMode === "new") {
      result = [...result].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          b.id - a.id,
      );
    }
    if (sortMode === "votes") {
      result = result.filter((mod) => upvotedIds.has(mod.id));
    }
    if (category !== "all") {
      result = result.filter((mod) =>
        projectCategories(mod.project.categories).includes(category),
      );
    }
    if (searching) {
      result = result.filter((mod) =>
        `${mod.project.name} ${mod.project.primaryAuthor ?? ""} ${mod.submitterName ?? ""}`
          .toLowerCase()
          .includes(query),
      );
    }
    return result;
  }, [
    allMods,
    rejectedMods,
    race.ranked,
    searching,
    sortMode,
    upvotedIds,
    category,
    query,
  ]);

  const packMatches = useMemo(() => {
    if (!searching || sortMode === "votes") return [];
    return (packRows ?? []).filter(
      (row) =>
        row.origin !== "suggestion" &&
        `${row.project.name} ${row.project.primaryAuthor ?? ""}`
          .toLowerCase()
          .includes(query) &&
        (category === "all" ||
          projectCategories(row.project.categories).includes(category)),
    );
  }, [packRows, searching, sortMode, category, query]);

  if (!page.data) return page.fallback;

  const { workshop, mods } = page.data;
  const isOpen = workshop.status === "open";
  const { rankById, maxRaceCount, categories } = race;
  const packMods = packRows ?? [];

  const filtering = searching || sortMode === "votes" || category !== "all";
  const remaining = visible.length - shownCount;

  const budget = myUpvotesQuery.data;
  const votesLeft = budget?.votesRemaining ?? null;

  const items: RaceItem[] = visible.slice(0, shownCount).map((mod) => {
    const votable =
      isOpen &&
      mod.status === "pending" &&
      !upvoteMutation.isPending &&
      user?.discordId != null;
    const hasFreeVote = upvotedIds.has(mod.id) || mod.submittedByMe;
    return {
      mod,
      rank: mod.status === "pending" ? (rankById.get(mod.id) ?? null) : null,
      barPct:
        mod.status === "pending"
          ? Math.round((mod.upvoteCount / maxRaceCount) * 92)
          : 0,
      upvoted: upvotedIds.has(mod.id),
      canUpvote:
        votable && (hasFreeVote || (votesLeft !== null && votesLeft > 0)),
      outOfVotes:
        votable && !hasFreeVote && votesLeft !== null && votesLeft <= 0,
    };
  });

  return (
    <WorkshopPageShell backTo="/workshop" backLabel="Back">
      <WorkshopPageHeader
        title={workshop.name}
        description={workshop.description}
        workshop={workshop}
        action={
          isOpen ? (
            <Button size="lg" asChild>
              <Link to={`/workshop/${slug}/suggest`}>Suggest mods</Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              This workshop is closed for suggestions.
            </p>
          )
        }
      />

      <main className="mt-10 flex flex-col gap-6">
        {packQuery.error ? (
          <ErrorState
            bordered
            compact
            message={packQuery.error.message}
            onRetry={() => packQuery.refetch()}
          />
        ) : (
          packMods.length > 0 && (
            <PackStrip slug={slug} mods={packMods}>
              <span className="text-[13px] font-semibold whitespace-nowrap">
                Already in the pack
              </span>
            </PackStrip>
          )
        )}

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-semibold">
            {searching ? "Suggestions" : "Top suggested mods"}
          </h2>
          {isOpen && budget && votesLeft !== null && (
            <span className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{votesLeft}</span>{" "}
              of {budget.maxUpvotes} votes left
            </span>
          )}
        </div>

        <FilterToolbar
          search={searchInput}
          onSearchChange={setSearchInput}
          placeholder="Search all suggestions..."
          view={view}
          onViewChange={changeView}
        >
          <FilterSelect
            value={category}
            onValueChange={(value) => setParam("category", value, "all")}
            options={categoryOptions(categories)}
            className="w-full sm:w-[150px]"
          />
          <FilterSelect
            value={sortMode}
            onValueChange={(value) => setParam("sort", value, "top")}
            options={SORT_OPTIONS}
            className="w-full sm:w-44"
          />
        </FilterToolbar>

        {searching && rejectedQuery.error && (
          <ErrorState
            bordered
            compact
            message={rejectedQuery.error.message}
            onRetry={() => rejectedQuery.refetch()}
          />
        )}

        {items.length === 0 ? (
          <DashedBox>
            {filtering
              ? "No suggestions match your search."
              : "No suggestions yet, be the first to suggest a mod!"}
            {searching && isOpen && (
              <>
                {" "}
                <Link
                  to={`/workshop/${slug}/suggest?q=${encodeURIComponent(searchInput.trim())}`}
                  className="text-primary hover:underline"
                >
                  Suggest it yourself
                </Link>
              </>
            )}
          </DashedBox>
        ) : (
          <Leaderboard
            items={items}
            allMods={mods}
            view={view}
            onOpen={(workshopModId) => {
              pushedModRef.current = true;
              setParam("mod", String(workshopModId), "", { replace: false });
            }}
            onUpvote={(item) => {
              if (item.outOfVotes) {
                toast.info(
                  "You're out of votes. Remove an upvote to free one up.",
                );
                return;
              }
              upvoteMutation.mutate({ workshopModId: item.mod.id });
            }}
          />
        )}

        <ShowMoreButton
          remaining={remaining}
          onClick={showMore}
          className="-mt-1"
        />

        {packMatches.length > 0 && (
          <PackSearchResults
            mods={packMatches}
            paginationKey={`${query}:${category}`}
          />
        )}
      </main>

      <ModDetailDialog
        workshopModId={openModId}
        onOpenChange={(open) => {
          if (open) return;
          if (pushedModRef.current) {
            pushedModRef.current = false;
            void navigate(-1);
          } else {
            setParam("mod", "");
          }
        }}
      />
    </WorkshopPageShell>
  );
}
