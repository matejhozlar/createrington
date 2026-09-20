export interface PodiumPlayer {
  username: string;
  uuid: string;
  value: number;
}

interface PodiumCardProps {
  containerId: string;
  banner: { src: string; alt: string };
  title: string;
  subtitle?: string;
  players: PodiumPlayer[];
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
  player: PodiumPlayer;
  skinSrc: string;
  rank: number;
  valueLabel: string;
}) {
  const style = MEDAL_STYLES[rank];

  return (
    <div className="flex flex-col items-center w-[220px]">
      <span
        className={`text-[18px] font-extrabold tracking-wider ${style.text}`}
      >
        {style.rank}
      </span>
      <div className="relative flex items-end justify-center mt-1">
        <div
          className={`absolute bottom-0 w-20 h-20 rounded-full blur-[40px] opacity-30 ${style.glow}`}
        />
        <img
          src={skinSrc}
          alt={player.username}
          className={`relative ${style.height} drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)]`}
        />
      </div>
      <span
        className={`text-[15px] font-bold tracking-wide mt-2 ${style.text}`}
      >
        {player.username}
      </span>
      <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {valueLabel}
      </span>
    </div>
  );
}

export function PodiumStatus({
  message,
  tone,
}: {
  message: string;
  tone: "muted" | "error";
}) {
  return (
    <div className="w-[900px] h-[500px] bg-background flex items-center justify-center">
      <span
        className={`text-base tracking-wide ${tone === "error" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {message}
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
    <div
      id={containerId}
      className="relative w-[900px] h-[500px] overflow-hidden bg-background text-foreground flex flex-col"
    >
      <div className="absolute inset-0 pointer-events-none render-bg-grid" />
      <div className="absolute left-1/2 -translate-x-1/2 -top-10 w-[400px] h-[400px] rounded-full blur-[120px] opacity-15 pointer-events-none bg-amber-400" />
      <div className="absolute -left-16 bottom-0 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-3" />
      <div className="absolute -right-16 bottom-0 w-[280px] h-[280px] rounded-full blur-[120px] opacity-10 pointer-events-none bg-chart-5" />

      <div className="flex items-center gap-4 px-8 pt-5 z-10">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <img
          src={banner.src}
          alt={banner.alt}
          className="h-[44px] [image-rendering:pixelated]"
        />
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
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

      <div className="pb-3.5 text-center z-10">
        <span className="text-[11px] font-semibold tracking-[0.3em] uppercase text-foreground/15">
          createrington.com
        </span>
      </div>
    </div>
  );
}
