import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Heart } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PlayerLabel } from "@/components/player-label";
import { ProjectThumb } from "../../components/ProjectThumb";
import { SocialLinks } from "../../components/SocialLinks";
import {
  MOD_STATUS_STYLES,
  liveTitle,
  projectCategories,
  REJECT_REASON_LABELS,
} from "../../format";

export type RaceMod = RouterOutput["user"]["workshops"]["get"]["mods"][number];

export interface RaceItem {
  mod: RaceMod;
  rank: number | null;
  barPct: number;
  upvoted: boolean;
  canUpvote: boolean;
  outOfVotes: boolean;
}

interface LeaderboardProps {
  items: RaceItem[];
  allMods: RaceMod[];
  view: "list" | "grid";
  onOpen: (workshopModId: number) => void;
  onUpvote: (item: RaceItem) => void;
}

const RANK_FONT = "'Minecraft', ui-monospace, monospace";
const BAR_TRANSITION =
  "transition-[width] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const REORDER_ANIMATION = {
  duration: 400,
  easing: "cubic-bezier(0.22,1,0.36,1)",
};

export function Leaderboard({
  items,
  allMods,
  view,
  onOpen,
  onUpvote,
}: LeaderboardProps) {
  const [containerRef, enableAnimations] =
    useAutoAnimate<HTMLDivElement>(REORDER_ANIMATION);
  const previousCountsRef = useRef<Map<number, number> | null>(null);
  const disableTimerRef = useRef<number | undefined>(undefined);

  // Votes are the only thing that changes a count; filters never do.
  // disable() cancels in-flight animations, so it must wait out the duration.
  useLayoutEffect(() => {
    const counts = new Map(allMods.map((mod) => [mod.id, mod.upvoteCount]));
    const previous = previousCountsRef.current;
    const voteChange =
      previous !== null &&
      [...counts].some(([id, count]) => {
        const previousCount = previous.get(id);
        return previousCount !== undefined && previousCount !== count;
      });
    if (voteChange) {
      window.clearTimeout(disableTimerRef.current);
      enableAnimations(true);
      disableTimerRef.current = window.setTimeout(() => {
        disableTimerRef.current = undefined;
        enableAnimations(false);
      }, REORDER_ANIMATION.duration + 50);
    } else if (disableTimerRef.current === undefined) {
      enableAnimations(false);
    }
    previousCountsRef.current = counts;
  });

  useEffect(() => () => window.clearTimeout(disableTimerRef.current), []);

  if (view === "grid") {
    return (
      <div
        ref={containerRef}
        className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3"
      >
        {items.map((item) => (
          <RaceCard
            key={item.mod.id}
            item={item}
            onOpen={onOpen}
            onUpvote={onUpvote}
          />
        ))}
      </div>
    );
  }
  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {items.map((item) => (
        <RaceRow
          key={item.mod.id}
          item={item}
          onOpen={onOpen}
          onUpvote={onUpvote}
        />
      ))}
    </div>
  );
}

interface RaceItemProps {
  item: RaceItem;
  onOpen: (workshopModId: number) => void;
  onUpvote: (item: RaceItem) => void;
}

function openOnActivate(onActivate: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    },
  };
}

function RaceRow({ item, onOpen, onUpvote }: RaceItemProps) {
  const { mod } = item;
  return (
    <div
      className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-border bg-card px-5 py-3.5 transition-colors hover:border-primary/40 focus-visible:border-primary/40"
      {...openOnActivate(() => onOpen(mod.id))}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-gradient-to-r from-primary/12 to-transparent",
          BAR_TRANSITION,
        )}
        style={{ width: `${item.barPct}%` }}
      />
      <span
        className="relative w-10 shrink-0 text-base text-primary"
        style={{ fontFamily: RANK_FONT }}
      >
        {item.rank !== null && `#${item.rank}`}
      </span>
      <ProjectThumb
        name={mod.project.name}
        thumbnailUrl={mod.project.thumbnailUrl}
        className="relative size-11 rounded-[10px] text-[13px]"
      />
      <div className="relative min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">
          {mod.project.name}
        </div>
        <div className="mt-[3px] flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
          <DotSeparated
            parts={[
              mod.project.primaryAuthor && (
                <span key="author" className="truncate">
                  by {mod.project.primaryAuthor}
                </span>
              ),
              submitterPart(mod),
              <span key="age">{formatRelativeDate(mod.createdAt)}</span>,
            ]}
          />
        </div>
      </div>
      <div className="relative mr-1 hidden items-center gap-3.5 sm:flex">
        <SocialLinks
          discordThreadUrl={mod.discordThreadUrl}
          websiteUrl={mod.project.websiteUrl}
          className="relative"
        />
      </div>
      <HeartOrBadge item={item} onUpvote={onUpvote} />
    </div>
  );
}

function RaceCard({ item, onOpen, onUpvote }: RaceItemProps) {
  const { mod } = item;
  const category = projectCategories(mod.project.categories)[0] ?? null;
  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-[18px] pb-5 transition-colors hover:border-primary/40 focus-visible:border-primary/40"
      {...openOnActivate(() => onOpen(mod.id))}
    >
      <div
        className={cn(
          "absolute bottom-0 left-0 z-[1] h-[3px] bg-gradient-to-r from-primary/55 to-primary/15",
          BAR_TRANSITION,
        )}
        style={{ width: `${item.barPct}%` }}
      />
      <div className="flex items-center gap-3">
        <ProjectThumb
          name={mod.project.name}
          thumbnailUrl={mod.project.thumbnailUrl}
          className="relative size-13 rounded-[10px] text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold">
            {mod.project.name}
          </div>
          {mod.project.primaryAuthor && (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              by {mod.project.primaryAuthor}
            </div>
          )}
        </div>
        {item.rank !== null && (
          <span
            className="shrink-0 self-start text-sm text-primary"
            style={{ fontFamily: RANK_FONT }}
          >
            #{item.rank}
          </span>
        )}
      </div>
      {mod.project.summary && (
        <p className="line-clamp-2 text-[13px] leading-[19px] text-muted-foreground">
          {mod.project.summary}
        </p>
      )}
      <div className="flex items-center gap-1.5 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
        <DotSeparated
          parts={[
            category && <span key="category">{category}</span>,
            submitterPart(mod),
            <span key="age">{formatRelativeDate(mod.createdAt)}</span>,
          ]}
        />
      </div>
      <div className="mt-auto flex items-center gap-3.5">
        <SocialLinks
          discordThreadUrl={mod.discordThreadUrl}
          websiteUrl={mod.project.websiteUrl}
          className="relative"
        />
        <span className="flex-1" />
        <HeartOrBadge item={item} onUpvote={onUpvote} />
      </div>
    </div>
  );
}

function DotSeparated({ parts }: { parts: ReactNode[] }) {
  const visible = parts.filter(Boolean);
  return (
    <>
      {visible.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span>·</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}

function submitterPart(mod: RaceMod): ReactNode {
  if (!mod.submitterName) return null;
  return (
    <PlayerLabel
      key="submitter"
      name={mod.submitterName}
      playerId={mod.submittedBy}
      size={16}
    />
  );
}

function HeartOrBadge({
  item,
  onUpvote,
}: {
  item: RaceItem;
  onUpvote: (item: RaceItem) => void;
}) {
  const { mod } = item;
  if (mod.status === "rejected") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "relative shrink-0",
          MOD_STATUS_STYLES.rejected.className,
        )}
      >
        {mod.rejectReason
          ? REJECT_REASON_LABELS[mod.rejectReason]
          : MOD_STATUS_STYLES.rejected.label}
      </Badge>
    );
  }
  if (mod.status !== "pending") {
    const style = MOD_STATUS_STYLES[mod.status];
    return (
      <Badge
        variant="outline"
        className={cn("relative shrink-0", style.className)}
        title={liveTitle(mod)}
      >
        {style.label}
      </Badge>
    );
  }
  return (
    <button
      type="button"
      disabled={!item.canUpvote && !item.outOfVotes}
      aria-label={
        item.upvoted
          ? "Remove upvote"
          : item.outOfVotes
            ? "Upvote (no votes left)"
            : "Upvote"
      }
      onClick={(event) => {
        event.stopPropagation();
        onUpvote(item);
      }}
      className={cn(
        "relative inline-flex min-w-[66px] shrink-0 items-center justify-center gap-1.5 rounded-[9px] border px-[13px] py-[7px] text-[13px] font-semibold tabular-nums transition-colors",
        item.upvoted
          ? "border-red-400/50 bg-red-400/10 text-red-400"
          : "border-border bg-accent/35 text-muted-foreground",
        (item.canUpvote || item.outOfVotes) && "cursor-pointer",
      )}
    >
      <Heart className={cn("size-3.5", item.upvoted && "fill-current")} />
      {mod.upvoteCount}
    </button>
  );
}
