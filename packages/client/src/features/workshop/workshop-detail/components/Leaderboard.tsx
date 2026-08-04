import { Fragment, type ReactNode } from "react";
import { Heart } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DiscordIcon } from "@/components/icons/discord";
import { CurseForgeIcon } from "@/components/icons/curseforge";
import { mcHeadsAvatar } from "@/lib/external-urls";
import {
  agoLabel,
  modInitials,
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
  ownSuggestion: boolean;
}

interface LeaderboardProps {
  items: RaceItem[];
  view: "list" | "grid";
  onOpen: (workshopModId: number) => void;
  onUpvote: (workshopModId: number) => void;
}

const RANK_FONT = "'Minecraft', ui-monospace, monospace";
const BAR_TRANSITION =
  "transition-[width] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)]";

export function Leaderboard({
  items,
  view,
  onOpen,
  onUpvote,
}: LeaderboardProps) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
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
    <div className="flex flex-col gap-2">
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
  onUpvote: (workshopModId: number) => void;
}

function RaceRow({ item, onOpen, onUpvote }: RaceItemProps) {
  const { mod } = item;
  return (
    <div
      className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-xl border border-border bg-card px-5 py-3.5 transition-colors hover:border-primary/40"
      onClick={() => onOpen(mod.id)}
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
      <ModThumb mod={mod} size="row" />
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
              <span key="age">{agoLabel(mod.createdAt)}</span>,
            ]}
          />
        </div>
      </div>
      <div className="relative mr-1 flex items-center gap-3.5">
        <SocialLinks mod={mod} />
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
      className="group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-[18px] pb-5 transition-colors hover:border-primary/40"
      onClick={() => onOpen(mod.id)}
    >
      <div
        className={cn(
          "absolute bottom-0 left-0 z-[1] h-[3px] bg-gradient-to-r from-primary/55 to-primary/15",
          BAR_TRANSITION,
        )}
        style={{ width: `${item.barPct}%` }}
      />
      <div className="flex items-center gap-3">
        <ModThumb mod={mod} size="card" />
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
            <span key="age">{agoLabel(mod.createdAt)}</span>,
          ]}
        />
      </div>
      <div className="mt-auto flex items-center gap-3.5">
        <SocialLinks mod={mod} />
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
    <span key="submitter" className="flex min-w-0 items-center gap-1.5">
      <img
        src={mcHeadsAvatar(mod.submitterName, 16)}
        alt=""
        width={16}
        height={16}
        className="rounded-xs [image-rendering:pixelated]"
      />
      <span className="truncate">{mod.submitterName}</span>
    </span>
  );
}

function ModThumb({ mod, size }: { mod: RaceMod; size: "row" | "card" }) {
  const sizeClass = size === "row" ? "size-11 text-[13px]" : "size-13 text-sm";
  if (mod.project.thumbnailUrl) {
    return (
      <img
        src={mod.project.thumbnailUrl}
        alt=""
        loading="lazy"
        className={cn(
          "relative shrink-0 rounded-[10px] object-cover",
          sizeClass,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-[10px] bg-secondary font-semibold text-muted-foreground",
        sizeClass,
      )}
    >
      {modInitials(mod.project.name)}
    </span>
  );
}

function SocialLinks({ mod }: { mod: RaceMod }) {
  const linkClass =
    "relative text-muted-foreground opacity-35 transition-[color,opacity] group-hover:opacity-100";
  return (
    <>
      {mod.discordThreadUrl && (
        <a
          href={mod.discordThreadUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="Discuss on Discord"
          title="Discuss on Discord"
          onClick={(event) => event.stopPropagation()}
          className={cn(linkClass, "hover:text-[#5865F2]")}
        >
          <DiscordIcon className="size-5" />
        </a>
      )}
      {mod.project.websiteUrl && (
        <a
          href={mod.project.websiteUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="View on CurseForge"
          title="View on CurseForge"
          onClick={(event) => event.stopPropagation()}
          className={cn(linkClass, "hover:text-[#F16436]")}
        >
          <CurseForgeIcon className="size-5" />
        </a>
      )}
    </>
  );
}

function HeartOrBadge({
  item,
  onUpvote,
}: {
  item: RaceItem;
  onUpvote: (workshopModId: number) => void;
}) {
  const { mod } = item;
  if (mod.status === "approved") {
    return (
      <Badge
        variant="outline"
        className="relative shrink-0 border-green-500/50 bg-green-500/10 text-green-400"
      >
        In the pack
      </Badge>
    );
  }
  if (mod.status === "rejected") {
    return (
      <Badge
        variant="outline"
        className="relative shrink-0 border-red-500/50 bg-red-500/10 text-red-400"
      >
        {mod.rejectReason
          ? REJECT_REASON_LABELS[mod.rejectReason]
          : "Ruled out"}
      </Badge>
    );
  }
  return (
    <button
      type="button"
      disabled={!item.canUpvote}
      title={
        item.ownSuggestion ? "You can't upvote your own suggestion" : undefined
      }
      aria-label={item.upvoted ? "Remove upvote" : "Upvote"}
      onClick={(event) => {
        event.stopPropagation();
        onUpvote(mod.id);
      }}
      className={cn(
        "relative inline-flex min-w-[66px] shrink-0 items-center justify-center gap-1.5 rounded-[9px] border px-[13px] py-[7px] text-[13px] font-semibold tabular-nums transition-colors",
        item.upvoted
          ? "border-red-400/50 bg-red-400/10 text-red-400"
          : "border-border bg-accent/35 text-muted-foreground",
        item.canUpvote && "cursor-pointer",
      )}
    >
      <Heart className={cn("size-3.5", item.upvoted && "fill-current")} />
      {mod.upvoteCount}
    </button>
  );
}
