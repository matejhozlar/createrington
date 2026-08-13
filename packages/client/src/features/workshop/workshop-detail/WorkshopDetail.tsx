import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Search, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useToastActions } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loading } from "@/components/loading-spinner";
import { NotFound } from "@/pages/not-found";
import { loaderName, projectCategories } from "../format";
import { PAGE_SIZE, WORDMARK_IMAGE } from "../constants";
import { useViewMode } from "../hooks/use-view-mode";
import { PackStrip } from "../components/PackStrip";
import { QueryErrorState } from "../components/QueryErrorState";
import { WorkshopDisabledState } from "../components/WorkshopEmptyState";
import { ViewToggle } from "../components/ViewToggle";
import { WorkshopHero } from "../components/WorkshopHero";
import {
  Leaderboard,
  type RaceItem,
  type RaceMod,
} from "./components/Leaderboard";
import { ModDetailDialog } from "./components/ModDetailDialog";
import { PackSearchResults } from "./components/PackSearchResults";

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
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const toast = useToastActions();
  const utils = trpc.useUtils();

  const [searchParams, setSearchParams] = useSearchParams();
  const [openModId, setOpenModId] = useState<number | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [view, changeView] = useViewMode("workshop-detail-view");

  const searchQuery = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort");
  const sortMode: SortMode =
    sortParam === "new" || sortParam === "votes" ? sortParam : "top";
  const query = useDebouncedValue(searchQuery.trim().toLowerCase(), 250);
  const searching = query.length > 0;

  const setFilterParam = (key: string, value: string, fallback: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
    setShownCount(PAGE_SIZE);
  };

  const workshopQuery = trpc.user.workshops.get.useQuery(
    { slug: slug! },
    { enabled: !!slug, retry: false },
  );
  const workshopId = workshopQuery.data?.workshop.id;

  const myUpvotesQuery = trpc.user.workshops.myUpvotes.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );
  const rejectedQuery = trpc.user.workshops.listRejected.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined && searching },
  );
  const packQuery = trpc.user.workshops.getPack.useQuery(
    { workshopId: workshopId! },
    { enabled: workshopId !== undefined },
  );

  const upvoteMutation = trpc.user.workshops.upvoteMod.useMutation({
    onMutate: async ({ workshopModId }) => {
      if (!slug || workshopId === undefined) return;
      await Promise.all([
        utils.user.workshops.get.cancel({ slug }),
        utils.user.workshops.myUpvotes.cancel({ workshopId }),
      ]);
      const previousGet = utils.user.workshops.get.getData({ slug });
      const previousUpvotes = utils.user.workshops.myUpvotes.getData({
        workshopId,
      });
      const removing = previousUpvotes?.modIds.includes(workshopModId) ?? false;
      utils.user.workshops.get.setData(
        { slug },
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
      utils.user.workshops.myUpvotes.setData(
        { workshopId },
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
        utils.user.workshops.get.setData({ slug }, context.previousGet);
      }
      if (workshopId !== undefined && context?.previousUpvotes) {
        utils.user.workshops.myUpvotes.setData(
          { workshopId },
          context.previousUpvotes,
        );
      }
      toast.error(error.message);
    },
    onSettled: () => {
      if (slug) utils.user.workshops.get.invalidate({ slug });
      if (workshopId !== undefined) {
        utils.user.workshops.myUpvotes.invalidate({ workshopId });
      }
      utils.user.workshops.list.invalidate();
    },
  });

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (workshopQuery.error) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          {workshopQuery.error.data?.code === "FORBIDDEN" ? (
            <WorkshopDisabledState />
          ) : (
            <QueryErrorState
              message={workshopQuery.error.message}
              onRetry={() => workshopQuery.refetch()}
            />
          )}
        </div>
      </div>
    );
  }

  if (workshopQuery.isLoading || !workshopQuery.data) {
    return (
      <Loading size="large" className="py-32" text="Loading workshop..." />
    );
  }

  const { workshop, mods } = workshopQuery.data;
  const isOpen = workshop.status === "open";
  const upvotedIds = new Set(myUpvotesQuery.data?.modIds ?? []);

  const packMods = packQuery.data?.mods ?? [];
  const pending = mods.filter((mod) => mod.status === "pending");
  const ranked = [...pending].sort(byRace);
  const rankById = new Map(ranked.map((mod, index) => [mod.id, index + 1]));
  const maxRaceCount = Math.max(1, ...ranked.map((mod) => mod.upvoteCount));

  const categories = [
    ...new Set(
      mods.flatMap((mod) => projectCategories(mod.project.categories)),
    ),
  ].sort();

  let visible: RaceMod[] = searching
    ? [...mods, ...(rejectedQuery.data ?? [])].sort(byRace)
    : ranked;
  if (sortMode === "new") {
    visible = [...visible].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
        b.id - a.id,
    );
  }
  if (sortMode === "votes") {
    visible = visible.filter((mod) => upvotedIds.has(mod.id));
  }
  if (category !== "all") {
    visible = visible.filter((mod) =>
      projectCategories(mod.project.categories).includes(category),
    );
  }
  if (searching) {
    visible = visible.filter((mod) =>
      `${mod.project.name} ${mod.project.primaryAuthor ?? ""} ${mod.submitterName ?? ""}`
        .toLowerCase()
        .includes(query),
    );
  }

  // Suggestion-origin members already surface via their approved suggestion row
  let packMatches =
    searching && sortMode !== "votes"
      ? packMods.filter(
          (row) =>
            row.origin !== "suggestion" &&
            `${row.project.name} ${row.project.primaryAuthor ?? ""}`
              .toLowerCase()
              .includes(query),
        )
      : [];
  if (category !== "all") {
    packMatches = packMatches.filter((row) =>
      projectCategories(row.project.categories).includes(category),
    );
  }

  const filtering = searching || sortMode === "votes" || category !== "all";
  const remaining = visible.length - shownCount;

  const budget = myUpvotesQuery.data;
  const votesLeft = budget?.votesRemaining ?? null;

  const items: RaceItem[] = visible.slice(0, shownCount).map((mod) => ({
    mod,
    rank: mod.status === "pending" ? (rankById.get(mod.id) ?? null) : null,
    barPct:
      mod.status === "pending"
        ? Math.round((mod.upvoteCount / maxRaceCount) * 92)
        : 0,
    upvoted: upvotedIds.has(mod.id),
    canUpvote:
      isOpen &&
      mod.status === "pending" &&
      !upvoteMutation.isPending &&
      user?.discordId != null &&
      (upvotedIds.has(mod.id) ||
        mod.submittedBy === user.discordId ||
        (votesLeft !== null && votesLeft > 0)),
    outOfVotes:
      isOpen &&
      mod.status === "pending" &&
      user?.discordId != null &&
      !upvotedIds.has(mod.id) &&
      mod.submittedBy !== user.discordId &&
      votesLeft === 0,
  }));

  return (
    <div className="relative overflow-hidden">
      <WorkshopHero className="h-[340px]" />

      <div className="relative mx-auto max-w-6xl px-5 pt-8 pb-16 md:px-8">
        <Link
          to="/workshop"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-[15px]" />
          Back
        </Link>

        <header className="mt-5 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[620px] min-w-0">
            <div className="flex flex-wrap items-center gap-3.5">
              <h1 className="text-4xl font-semibold text-shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
                {workshop.name}
              </h1>
              <div className="flex gap-2">
                <Badge variant="outline">{workshop.gameVersion}</Badge>
                <Badge variant="outline">
                  {loaderName(workshop.modLoaderType)}
                </Badge>
              </div>
            </div>
            {workshop.description && (
              <p className="mt-4 max-w-2xl text-base text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.4)]">
                {workshop.description}
              </p>
            )}
            <div className="mt-6">
              {isOpen ? (
                <Button size="lg" asChild>
                  <Link to={`/workshop/${slug}/suggest`}>Suggest mods</Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This workshop is closed for suggestions.
                </p>
              )}
            </div>
          </div>
          <img
            src={WORDMARK_IMAGE}
            alt="Createrington"
            className="hidden w-[280px] drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)] md:block"
          />
        </header>

        <main className="mt-10 flex flex-col gap-6">
          {packQuery.error ? (
            <QueryErrorState
              compact
              message={packQuery.error.message}
              onRetry={() => packQuery.refetch()}
            />
          ) : (
            packMods.length > 0 && (
              <PackStrip slug={slug!} mods={packMods}>
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
                <span className="font-semibold text-foreground">
                  {votesLeft}
                </span>{" "}
                of {budget.maxUpvotes} votes left
              </span>
            )}
          </div>

          <div className="-mt-2 flex flex-wrap items-center gap-2.5">
            <div className="relative w-full min-w-0 flex-none sm:max-w-[420px] sm:min-w-[200px] sm:flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) =>
                  setFilterParam("q", event.target.value, "")
                }
                placeholder="Search all suggestions..."
                className="h-9 rounded-lg bg-white/[0.03] pr-8 pl-8 text-[13px]"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={() => setFilterParam("q", "", "")}
                  className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X />
                </Button>
              )}
            </div>
            <span className="hidden flex-1 sm:block" />
            <Select
              value={category}
              onValueChange={(value) =>
                setFilterParam("category", value, "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortMode}
              onValueChange={(value) => setFilterParam("sort", value, "top")}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ViewToggle view={view} onChange={changeView} />
          </div>

          {searching && rejectedQuery.error && (
            <QueryErrorState
              compact
              message={rejectedQuery.error.message}
              onRetry={() => rejectedQuery.refetch()}
            />
          )}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-muted-foreground">
              {filtering
                ? "No suggestions match your search."
                : "No suggestions yet, be the first to suggest a mod!"}
              {searching && isOpen && (
                <>
                  {" "}
                  <Link
                    to={`/workshop/${slug}/suggest?q=${encodeURIComponent(searchQuery.trim())}`}
                    className="text-primary hover:underline"
                  >
                    Suggest it yourself
                  </Link>
                </>
              )}
            </div>
          ) : (
            <Leaderboard
              key={`${view}:${sortMode}:${category}:${query}`}
              items={items}
              view={view}
              onOpen={setOpenModId}
              onUpvote={(workshopModId) => {
                const item = items.find(
                  (entry) => entry.mod.id === workshopModId,
                );
                if (item?.outOfVotes) {
                  toast.info(
                    "You're out of votes. Remove an upvote to free one up.",
                  );
                  return;
                }
                upvoteMutation.mutate({ workshopModId });
              }}
            />
          )}

          {remaining > 0 && (
            <div className="-mt-1 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => setShownCount(shownCount + PAGE_SIZE)}
              >
                Show {Math.min(remaining, PAGE_SIZE)} more
              </Button>
            </div>
          )}

          {packMatches.length > 0 && (
            <PackSearchResults
              key={`${query}:${category}`}
              mods={packMatches}
            />
          )}
        </main>
      </div>

      <ModDetailDialog
        workshopModId={openModId}
        onOpenChange={(open) => {
          if (!open) setOpenModId(null);
        }}
      />
    </div>
  );
}
