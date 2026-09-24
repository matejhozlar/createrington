import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, UserPlus } from "lucide-react";
import type { KnownPose } from "createrington-skin-api";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
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
  text: string;
  side: Side | null;
}

const SLOTS = [
  {
    figure: "left-[3%] md:left-[6%]",
    glow: "-left-16 md:left-10",
    band: "items-start text-left",
    align: "start",
  },
  {
    figure: "right-[3%] md:right-[6%]",
    glow: "-right-16 md:right-10",
    band: "items-end text-right",
    align: "end",
  },
] as const;

function StageFigure({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && (
        <Spinner className="absolute top-1/2 left-1/2 size-7 -translate-1/2 text-(--side) md:size-9" />
      )}
      <div
        aria-hidden
        className={cn(
          "absolute -bottom-1.5 left-1/2 h-3 w-2/5 -translate-x-1/2 rounded-[100%] bg-black/70 blur-md transition-opacity duration-500",
          !loaded && "opacity-0",
        )}
      />
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "relative max-h-full max-w-full object-contain transition-[opacity,translate] duration-500 select-none",
          loaded ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      />
    </>
  );
}

function RankChips({ ranks }: { ranks: ComparedPlayer["ranks"] }) {
  const chips = RANK_LABELS.filter(({ board }) => ranks[board] !== null);
  return (
    <div className="flex flex-wrap gap-1 group-data-[side=1]:justify-end md:gap-1.5">
      {chips.map(({ board, label }) => (
        <span
          key={board}
          className="rounded-full bg-(--side)/12 px-2 py-0.5 text-[11px] font-semibold text-(--side) md:text-xs"
        >
          #{ranks[board]} {label}
        </span>
      ))}
    </div>
  );
}

export function CompareStage({
  sides,
  poses,
  score,
  initialOpen,
  onPick,
}: {
  sides: [StageSide | null, StageSide | null];
  poses: [KnownPose, KnownPose];
  score: StageScore | null;
  initialOpen: Side | null;
  onPick: (side: Side, minecraftUsername: string) => void;
}) {
  const [openSide, setOpenSide] = useState<Side | null>(initialOpen);
  const exclude = sides.map((side) => side?.minecraftUsername ?? null);

  return (
    <section className="relative h-[380px] overflow-hidden rounded-2xl border border-white/8 bg-card/60 md:h-[520px]">
      {SLOTS.map((slot, index) => (
        <div
          key={`glow-${index}`}
          aria-hidden
          className={cn(
            "absolute top-10 size-56 rounded-full opacity-15 blur-[70px] md:top-24 md:size-80 md:blur-[90px]",
            slot.glow,
          )}
          style={{ background: SIDE_COLORS[index] }}
        />
      ))}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-[118px] h-px bg-white/10 md:bottom-[120px]"
      />
      <span
        aria-hidden
        className="absolute top-24 left-1/2 -translate-x-1/2 text-6xl font-extrabold tracking-tighter text-white/[0.07] md:top-28 md:text-[120px]"
      >
        VS
      </span>
      {score && (
        <div
          className="absolute top-[250px] left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-(--side)/40 bg-(--side)/10 px-4 py-2 text-[15px] font-semibold whitespace-nowrap md:flex"
          style={
            {
              "--side":
                score.side === null ? "#a1a1aa" : SIDE_COLORS[score.side],
            } as CSSProperties
          }
        >
          <span className="size-2 rounded-full bg-(--side)" />
          {score.text}
        </div>
      )}

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

        return (
          <div
            key={index}
            data-side={side}
            className="group"
            style={{ "--side": SIDE_COLORS[side] } as CSSProperties}
          >
            <div
              className={cn(
                "absolute bottom-[112px] flex h-[200px] w-[42%] items-end justify-center md:h-[360px] md:w-[300px]",
                slot.figure,
              )}
            >
              {player ? (
                <StageFigure
                  key={`${player.minecraftUuid}-${poses[side]}`}
                  src={poseSrc(player.minecraftUuid, poses[side])}
                  alt={player.minecraftUsername}
                />
              ) : (
                picker(
                  <button
                    type="button"
                    className="mb-4 flex h-[82%] w-3/5 max-w-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 text-white/25 transition-colors outline-none hover:border-(--side)/50 hover:text-(--side) focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <UserPlus className="size-8 md:size-10" aria-hidden />
                    <span className="text-xs font-semibold md:text-sm">
                      Pick a player
                    </span>
                  </button>,
                )
              )}
            </div>

            <div
              className={cn(
                "absolute bottom-0 flex h-[118px] w-1/2 flex-col justify-center gap-1.5 px-3.5 md:h-[120px] md:gap-2 md:px-14",
                side === 0 ? "left-0" : "right-0",
                slot.band,
              )}
            >
              {player ? (
                <>
                  {picker(
                    <button
                      type="button"
                      aria-label={`Change ${player.minecraftUsername}`}
                      className="-mx-2 inline-flex h-11 max-w-full items-center gap-1.5 rounded-lg px-2 text-lg font-bold text-(--side) transition-colors outline-none hover:bg-white/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-10 md:text-2xl"
                    >
                      <span className="truncate">
                        {player.minecraftUsername}
                      </span>
                      <ChevronDown
                        className="size-4 shrink-0 opacity-60"
                        aria-hidden
                      />
                    </button>,
                  )}
                  {player.ranks && <RankChips ranks={player.ranks} />}
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Pick a challenger
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
