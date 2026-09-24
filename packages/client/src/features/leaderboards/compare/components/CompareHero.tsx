import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronDown,
  Dices,
  Link2,
  UserPlus,
} from "lucide-react";
import type { KnownPose } from "createrington-skin-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PopoverAnchor } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { HERO_BACKDROP } from "../../top-roles";
import {
  poseSrc,
  RANK_LABELS,
  SIDE_COLORS,
  type ComparedPlayer,
} from "../headToHead";
import type { Side } from "../hooks/use-compare-params";
import { PlayerPicker } from "./PlayerPicker";

export interface StageSide {
  minecraftUuid: string;
  minecraftUsername: string;
  ranks: ComparedPlayer["ranks"] | null;
}

export interface StageScore {
  counts: [number, number];
  leader: Side | null;
}

export const HERO_ACTIONS = [
  { key: "reroll", label: "Reroll poses", icon: Dices },
  { key: "swap", label: "Swap sides", icon: ArrowLeftRight },
  { key: "copy", label: "Copy link", icon: Link2 },
] as const;

export type HeroAction = (typeof HERO_ACTIONS)[number]["key"];

const FIGURE_HEIGHT =
  "h-[min(30vh,52cqw)] @xl:h-[min(42vh,44cqw)] @3xl:h-[min(52vh,38cqw)]";

const SLOTS = [
  {
    column: "col-start-1",
    enter: { "--from-x": "-72px", "--enter-delay": "0.1s" } as CSSProperties,
    align: "start",
  },
  {
    column: "col-start-3",
    enter: { "--from-x": "72px", "--enter-delay": "0.22s" } as CSSProperties,
    align: "end",
  },
] as const;

function StageFigure({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className={cn("relative flex items-end", FIGURE_HEIGHT)}>
      {!loaded && (
        <Spinner className="absolute top-1/2 left-1/2 size-7 -translate-1/2 text-(--side) md:size-9" />
      )}
      <span
        className={cn(
          "relative block h-full",
          loaded ? "lb-duel-enter" : "opacity-0",
        )}
      >
        <span
          aria-hidden
          className="absolute bottom-0.5 left-1/2 h-3 w-3/4 -translate-x-1/2 rounded-[100%] bg-black/70 blur-md"
        />
        <img
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-x-0 top-full h-[38%] w-full -scale-y-100 object-cover object-bottom opacity-20 blur-[1px] [mask-image:linear-gradient(to_top,rgba(0,0,0,0.9),transparent)]"
        />
        <img
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className="relative h-full w-auto max-w-none select-none"
        />
      </span>
    </span>
  );
}

function RankChips({ ranks }: { ranks: ComparedPlayer["ranks"] }) {
  const chips = RANK_LABELS.filter(({ board }) => ranks[board] !== null);
  return (
    <div className="flex flex-wrap justify-center gap-1 md:gap-1.5">
      {chips.map(({ board, label }) => (
        <span
          key={board}
          className="rounded-full border border-(--side)/30 bg-(--side)/10 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-(--side) md:text-xs"
        >
          #{ranks[board]} {label}
        </span>
      ))}
    </div>
  );
}

function Tally({ value, className }: { value: number; className: string }) {
  return (
    <span
      aria-hidden
      className={cn("lb-count tabular-nums", className)}
      style={{ "--to": value } as CSSProperties}
    />
  );
}

function ScoreBoard({
  score,
  names,
}: {
  score: StageScore;
  names: [string, string];
}) {
  const [first, second] = score.counts;
  const summary =
    score.leader === null
      ? `Dead even, ${first} to ${second}`
      : `${names[score.leader]} leads ${Math.max(first, second)} to ${Math.min(first, second)}`;

  return (
    <div className="lb-hero-caption flex flex-col items-center [--enter-delay:0.5s]">
      <span className="sr-only">{summary}</span>
      <div className="flex items-baseline gap-2 text-4xl font-extrabold md:gap-3 md:text-7xl">
        <Tally value={first} className="text-(--left)" />
        <span className="text-2xl text-white/25 md:text-5xl">–</span>
        <Tally value={second} className="text-(--right)" />
      </div>
      <span
        aria-hidden
        className="mt-1 max-w-32 truncate text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground md:max-w-none md:text-xs"
      >
        {score.leader === null ? "Dead even" : `${names[score.leader]} leads`}
      </span>
    </div>
  );
}

export function CompareHero({
  sides,
  poses,
  score,
  initialOpen,
  loading,
  actionsEnabled,
  rerollCooling,
  onPick,
  onAction,
}: {
  sides: [StageSide | null, StageSide | null];
  poses: [KnownPose, KnownPose];
  score: StageScore | null;
  initialOpen: Side | null;
  loading: [boolean, boolean];
  actionsEnabled: boolean;
  rerollCooling: boolean;
  onPick: (side: Side, minecraftUsername: string) => void;
  onAction: (action: HeroAction, at: number) => void;
}) {
  const [openSide, setOpenSide] = useState<Side | null>(initialOpen);
  const exclude = sides.map((side) => side?.minecraftUsername ?? null);
  const names = sides.map((side) => side?.minecraftUsername ?? "") as [
    string,
    string,
  ];

  return (
    <section className="sticky top-14 z-0 h-[calc(100svh-3.5rem)] overflow-hidden bg-background md:top-0 md:h-svh">
      <img
        src={HERO_BACKDROP}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] max-w-none object-cover blur-[6px] brightness-[0.32] saturate-[0.7]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-background from-[8%] to-transparent to-[55%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-background to-transparent to-[35%]"
      />

      <div className="@container relative mx-auto flex h-full max-w-7xl flex-col px-5 md:px-8">
        <header className="flex flex-col items-center pt-6 text-center md:pt-12">
          <Link
            to="/leaderboards"
            className="inline-flex h-8 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Leaderboards
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            Head to head
          </h1>
          <div className="mt-4 flex gap-2 md:mt-6">
            {HERO_ACTIONS.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant="outline"
                onClick={(event) => onAction(key, event.timeStamp)}
                disabled={
                  (key !== "copy" && !actionsEnabled) ||
                  (key === "reroll" && rerollCooling)
                }
                aria-label={label}
                className="size-11 md:size-auto"
              >
                <Icon aria-hidden />
                <span className="hidden md:inline">{label}</span>
              </Button>
            ))}
          </div>
        </header>

        <div className="relative grid flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_auto] content-center items-end gap-x-2 pb-[4vh] md:gap-x-8">
          <div
            aria-hidden
            className="col-[1/-1] row-start-1 h-px w-full self-end bg-linear-to-r from-transparent via-white/15 to-transparent"
          />

          <div className="col-start-2 row-start-1 flex flex-col items-center self-center">
            <span
              aria-hidden
              className="lb-vs-slam text-[clamp(3rem,11cqw,8rem)] leading-none font-extrabold tracking-tighter text-white/10 italic"
            >
              VS
            </span>
            {score && <ScoreBoard score={score} names={names} />}
          </div>

          {SLOTS.map((slot, index) => {
            const side = index as Side;
            const player = sides[side];
            const picker = (trigger: ReactNode) => (
              <PlayerPicker
                open={openSide === side}
                onOpenChange={(open) => setOpenSide(open ? side : null)}
                exclude={exclude}
                rivalRank={sides[side === 0 ? 1 : 0]?.ranks?.playtime ?? null}
                align={slot.align}
                onPick={(minecraftUsername) => onPick(side, minecraftUsername)}
              >
                {trigger}
              </PlayerPicker>
            );
            const sideStyle = {
              "--side": SIDE_COLORS[side],
              ...slot.enter,
            } as CSSProperties;

            return [
              <div
                key={`figure-${side}`}
                className={cn(
                  "relative row-start-1 flex min-w-0 justify-center",
                  slot.column,
                )}
                style={sideStyle}
              >
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute top-1/2 left-1/2 size-56 -translate-1/2 rounded-full bg-(--side) blur-[70px] transition-opacity duration-700 md:size-80 md:blur-[100px]",
                    !player
                      ? "opacity-0"
                      : score?.leader === side
                        ? "opacity-35"
                        : "opacity-20",
                  )}
                />
                {player ? (
                  <StageFigure
                    key={`${player.minecraftUuid}-${poses[side]}`}
                    src={poseSrc(player.minecraftUuid, poses[side])}
                    alt={player.minecraftUsername}
                  />
                ) : loading[side] ? (
                  <span
                    className={cn(
                      "relative flex items-center justify-center",
                      FIGURE_HEIGHT,
                    )}
                  >
                    <Spinner className="size-7 text-(--side) md:size-9" />
                  </span>
                ) : (
                  picker(
                    <button
                      type="button"
                      className={cn(
                        "mb-4 flex aspect-[2/3] cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-(--side)/35 bg-(--side)/5 text-(--side)/70 transition-colors outline-none hover:border-(--side)/60 hover:text-(--side) focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        FIGURE_HEIGHT,
                      )}
                    >
                      <PopoverAnchor asChild>
                        <span className="flex flex-col items-center gap-2">
                          <UserPlus className="size-8 md:size-10" aria-hidden />
                          <span className="text-xs font-semibold md:text-sm">
                            Pick a player
                          </span>
                        </span>
                      </PopoverAnchor>
                    </button>,
                  )
                )}
              </div>,
              <div
                key={`caption-${side}`}
                className={cn(
                  "row-start-2 flex min-w-0 flex-col items-center gap-1.5 self-start pt-4 md:gap-2 md:pt-6",
                  slot.column,
                )}
                style={sideStyle}
              >
                {player ? (
                  <div className="lb-hero-caption flex min-w-0 flex-col items-center gap-1.5 md:gap-2">
                    {picker(
                      <button
                        type="button"
                        aria-label={`Change ${player.minecraftUsername}`}
                        className="inline-flex h-11 max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 text-lg font-bold text-(--side) drop-shadow-md transition-colors outline-none hover:bg-white/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-3xl"
                      >
                        <span className="truncate">
                          {player.minecraftUsername}
                        </span>
                        <ChevronDown
                          className="size-4 shrink-0 opacity-60 md:size-5"
                          aria-hidden
                        />
                      </button>,
                    )}
                    {player.ranks && <RankChips ranks={player.ranks} />}
                  </div>
                ) : loading[side] ? (
                  <div
                    aria-hidden
                    className="flex flex-col items-center gap-1.5 md:gap-2"
                  >
                    <span className="my-1.5 h-8 w-28 animate-pulse rounded-lg bg-white/8 md:h-9 md:w-44" />
                    <span className="h-5 w-32 animate-pulse rounded-full bg-white/5 md:w-48" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Pick a challenger
                  </span>
                )}
              </div>,
            ];
          })}
        </div>
      </div>
    </section>
  );
}
