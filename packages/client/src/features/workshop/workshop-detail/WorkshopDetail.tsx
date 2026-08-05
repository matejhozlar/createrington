import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { trpc, type RouterOutput } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
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
import { Skeleton } from "@/components/ui/skeleton";
import { NotFound } from "@/pages/not-found";
import { loaderName, modInitials, projectCategories } from "../format";
import { ViewToggle } from "../components/ViewToggle";
import {
  Leaderboard,
  type RaceItem,
  type RaceMod,
} from "./components/Leaderboard";
import { ModDetailDialog } from "./components/ModDetailDialog";

const HERO_IMAGE = "/assets/hero/royal-albert-hall.webp";
const WORDMARK_IMAGE = "/assets/createrington-woodmark.png";
const PAGE_SIZE = 10;
const VIEW_STORAGE_KEY = "workshop-detail-view";

type SortMode = "top" | "new" | "votes";
type ViewMode = "list" | "grid";
type PackMod = RouterOutput["user"]["workshops"]["pack"][number];

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

  const [openModId, setOpenModId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === "grid" ? "grid" : "list",
  );

  const query = searchQuery.trim().toLowerCase();
  const searching = query.length > 0;

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
  const packQuery = trpc.user.workshops.pack.useQuery(
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
    },
  });

  const changeView = (next: ViewMode) => {
    localStorage.setItem(VIEW_STORAGE_KEY, next);
    setView(next);
  };

  if (workshopQuery.error?.data?.code === "NOT_FOUND") {
    return <NotFound />;
  }

  if (workshopQuery.isLoading || !workshopQuery.data) {
    return (
      <div className="px-5 py-10 md:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const { workshop, mods } = workshopQuery.data;
  const isOpen = workshop.status === "open";
  const upvotedIds = new Set(myUpvotesQuery.data?.modIds ?? []);

  const packMods = packQuery.data ?? [];
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
  const shown = filtering ? visible.length : shownCount;
  const remaining = visible.length - shown;

  const items: RaceItem[] = visible.slice(0, shown).map((mod) => ({
    mod,
    rank: mod.status === "pending" ? (rankById.get(mod.id) ?? null) : null,
    barPct:
      mod.status === "pending"
        ? Math.round((mod.upvoteCount / maxRaceCount) * 92)
        : 0,
    upvoted: upvotedIds.has(mod.id),
    canUpvote:
      isOpen && mod.status === "pending" && mod.submittedBy !== user?.discordId,
    ownSuggestion: mod.submittedBy === user?.discordId,
  }));

  const budget = myUpvotesQuery.data;
  const votesLeft = budget
    ? Math.max(
        0,
        budget.maxUpvotes -
          pending.filter((mod) => upvotedIds.has(mod.id)).length,
      )
    : null;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-x-0 top-0 h-[340px] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="h-full w-full object-cover grayscale-50"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, var(--background) 0%, oklch(from var(--background) l c h / 0.85) 45%, oklch(from var(--background) l c h / 0.4) 100%)",
          }}
        />
      </div>

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
              <h1 className="text-[38px] leading-[42px] font-bold text-shadow-[0_2px_8px_rgb(0_0_0/0.4)]">
                {workshop.name}
              </h1>
              <Badge variant="outline">{workshop.gameVersion}</Badge>
              <Badge variant="outline">
                {loaderName(workshop.modLoaderType)}
              </Badge>
            </div>
            {workshop.description && (
              <p className="mt-3 text-[15px] leading-6 text-zinc-200 text-shadow-[0_1px_4px_rgb(0_0_0/0.4)]">
                {workshop.description}
              </p>
            )}
            <div className="mt-5">
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
          {packMods.length > 0 && <ApprovedStrip mods={packMods} />}

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-2xl leading-[30px] font-semibold">
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
            <div className="relative max-w-[420px] min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search all suggestions..."
                className="h-9 rounded-lg bg-white/[0.03] pl-8 text-[13px]"
              />
            </div>
            <span className="flex-1" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[150px]">
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
              onValueChange={(value) => setSortMode(value as SortMode)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Most upvoted</SelectItem>
                <SelectItem value="new">Newest first</SelectItem>
                <SelectItem value="votes">My votes</SelectItem>
              </SelectContent>
            </Select>
            <ViewToggle view={view} onChange={changeView} />
          </div>

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
              items={items}
              view={view}
              onOpen={setOpenModId}
              onUpvote={(workshopModId) =>
                upvoteMutation.mutate({ workshopModId })
              }
            />
          )}

          {remaining > 0 && (
            <div className="-mt-1 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => setShownCount(shown + PAGE_SIZE)}
              >
                Show {Math.min(remaining, PAGE_SIZE)} more
              </Button>
            </div>
          )}

          {packMatches.length > 0 && <PackSearchResults mods={packMatches} />}
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

function packCredit(row: PackMod): string {
  if (row.origin === "admin") {
    return `Added by ${row.addedByName ?? "an admin"}`;
  }
  if (row.origin === "dependency") {
    return row.requiredBy.length > 0
      ? `Required by ${row.requiredBy.map((r) => r.name).join(", ")}`
      : "Required dependency";
  }
  return row.liveInVersion
    ? `Added with ${row.liveInVersion}`
    : "Shipped with the pack";
}

function PackSearchResults({ mods }: { mods: PackMod[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Already in the pack
      </h3>
      {mods.map((row) => (
        <a
          key={row.id}
          href={row.project.websiteUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 transition-colors hover:border-primary/40"
        >
          {row.project.thumbnailUrl ? (
            <img
              src={row.project.thumbnailUrl}
              alt=""
              loading="lazy"
              className="size-9 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold text-muted-foreground">
              {modInitials(row.project.name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {row.project.name}
              {row.project.primaryAuthor && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  by {row.project.primaryAuthor}
                </span>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {packCredit(row)}
            </div>
          </div>
          {row.liveAt ? (
            <Badge
              variant="outline"
              className="shrink-0 border-green-500/50 bg-green-500/10 text-green-400"
            >
              Live
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-sky-500/50 bg-sky-500/10 text-sky-400"
            >
              Approved
            </Badge>
          )}
        </a>
      ))}
    </div>
  );
}

function ApprovedStrip({
  mods,
}: {
  mods: Array<{
    id: number;
    project: { name: string; thumbnailUrl: string | null };
  }>;
}) {
  const shown = mods.slice(0, 4);
  const extra = mods.length - shown.length;
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-accent/15 px-5 py-3.5">
      <span className="text-[13px] font-semibold whitespace-nowrap">
        Already in the pack
      </span>
      <span className="flex items-center gap-1.5">
        {shown.map((mod) =>
          mod.project.thumbnailUrl ? (
            <img
              key={mod.id}
              src={mod.project.thumbnailUrl}
              alt={mod.project.name}
              title={mod.project.name}
              width={32}
              height={32}
              className="size-8 rounded-lg object-cover"
            />
          ) : (
            <span
              key={mod.id}
              title={mod.project.name}
              className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground"
            >
              {modInitials(mod.project.name)}
            </span>
          ),
        )}
        {extra > 0 && (
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-[10px] font-semibold text-muted-foreground">
            +{extra}
          </span>
        )}
      </span>
    </div>
  );
}
