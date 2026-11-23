import { RenderFrame } from "./RenderFrame";
import { cn } from "@/lib/utils";
import { RenderTeamTag } from "./RenderTeamTag";
import type { RenderPodiumPlayer } from "@createrington/shared/render";

interface PodiumCardProps {
  containerId: string;
  banner: { src: string; alt: string };
  title: string;
  subtitle?: string;
  players: RenderPodiumPlayer[];
  skins: string[];
  emptyText: string;
  formatValue: (value: number) => string;
}

const MEDAL_STYLES = [
  {
    glow: "bg-amber-400",
    text: "text-amber-400",
    height: "h-[240px]",
    rank: "#1",
  },
  {
    glow: "bg-zinc-400",
    text: "text-zinc-400",
    height: "h-[200px]",
    rank: "#2",
  },
  {
    glow: "bg-amber-600",
    text: "text-amber-600",
    height: "h-[200px]",
    rank: "#3",
  },
];

const PODIUM_ORDER = [1, 0, 2];

function PodiumEntry({
  player,
  skinSrc,
  rank,
  valueLabel,
}: {
  player: RenderPodiumPlayer;
  skinSrc: string;
  rank: number;
  valueLabel: string;
}) {
  const style = MEDAL_STYLES[rank];

  return (
    <div className="flex flex-col items-center w-[220px]">
      <span
        className={cn("text-[18px] font-extrabold tracking-wider", style.text)}
      >
        {style.rank}
      </span>
      <div className="relative flex items-end justify-center mt-1">
        <div
          className={cn(
            "absolute bottom-0 h-20 w-20 rounded-full opacity-30 blur-[40px]",
            style.glow,
          )}
        />
        <img
          src={skinSrc}
          alt={player.username}
          className={cn(
            "relative drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]",
            style.height,
          )}
        />
      </div>
      <div className="mt-2 flex flex-col items-center gap-1">
        <RenderTeamTag code={player.tagCode} height={18} />
        <span className={cn("text-[15px] font-bold tracking-wide", style.text)}>
          {player.username}
        </span>
      </div>
      <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {valueLabel}
      </span>
    </div>
  );
}

export function PodiumCard({
  containerId,
  banner,
  title,
  subtitle,
  players,
  skins,
  emptyText,
  formatValue,
}: PodiumCardProps) {
  return (
    <RenderFrame
      id={containerId}
      banner={banner}
      glows={[
        "-top-10 left-1/2 h-[400px] w-[400px] -translate-x-1/2 bg-amber-400 opacity-15",
        "-left-16 bottom-0 h-[280px] w-[280px] bg-chart-3 opacity-10",
        "-right-16 bottom-0 h-[280px] w-[280px] bg-chart-5 opacity-10",
      ]}
    >
      <div className="text-center pt-2 z-10">
        <h2 className="text-2xl font-bold tracking-wide text-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[13px] font-medium tracking-wide text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-8 z-10">
        {players.length === 0 ? (
          <span className="text-lg text-muted-foreground pb-20">
            {emptyText}
          </span>
        ) : (
          PODIUM_ORDER.map((rank) => {
            const player = players[rank];
            const skinSrc = skins[rank];
            if (!player || !skinSrc) return null;
            return (
              <PodiumEntry
                key={rank}
                player={player}
                skinSrc={skinSrc}
                rank={rank}
                valueLabel={formatValue(player.value)}
              />
            );
          })
        )}
      </div>
    </RenderFrame>
  );
}
