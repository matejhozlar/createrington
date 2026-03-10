import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  AlertTriangle,
  Droplets,
  Pickaxe,
  Flame,
  Gift,
  Anchor,
  Sparkles,
} from "lucide-react";

const EVENT_ICONS: Record<string, typeof TrendingUp> = {
  bull_run: TrendingUp,
  bear_market: TrendingDown,
  flash_crash: Zap,
  pump_and_dump: AlertTriangle,
  liquidity_drought: Droplets,
  gold_rush: Pickaxe,
  supply_shock: Flame,
  tax_holiday: Gift,
  whale_dump: Anchor,
  new_listing_frenzy: Sparkles,
};

const EVENT_COLORS: Record<string, string> = {
  bull_run: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  bear_market: "border-red-500/50 bg-red-500/10 text-red-400",
  flash_crash: "border-red-500/50 bg-red-500/10 text-red-400",
  pump_and_dump: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  liquidity_drought: "border-orange-500/50 bg-orange-500/10 text-orange-400",
  gold_rush: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400",
  supply_shock: "border-orange-500/50 bg-orange-500/10 text-orange-400",
  tax_holiday: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
  whale_dump: "border-red-500/50 bg-red-500/10 text-red-400",
  new_listing_frenzy: "border-blue-500/50 bg-blue-500/10 text-blue-400",
};

/** Formats the time remaining until an event expires as a human-readable string (e.g. "45m left" or "1.5h left"). */
function formatRemaining(activeUntil: string): string {
  const remaining = Math.max(
    0,
    Math.round((new Date(activeUntil).getTime() - Date.now()) / 60_000),
  );
  if (remaining > 60) return `${(remaining / 60).toFixed(1)}h left`;
  return `${remaining}m left`;
}

/** Displays a single active event banner. */
function EventBanner({
  event,
}: {
  event: {
    id: number;
    type: string;
    name: string;
    description: string | null;
    tokenSymbol: string | null;
    activeUntil: string | null;
  };
}) {
  const Icon = EVENT_ICONS[event.type] ?? Zap;
  const colorClass =
    EVENT_COLORS[event.type] ??
    "border-blue-500/50 bg-blue-500/10 text-blue-400";

  let description = event.description ?? "";
  if (event.tokenSymbol) {
    description = description.replace(/\{token\}/g, event.tokenSymbol);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300",
        colorClass,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{event.name}</span>
          {event.tokenSymbol && (
            <span className="text-xs opacity-75">[{event.tokenSymbol}]</span>
          )}
        </div>
        <p className="text-xs opacity-75 truncate">{description}</p>
      </div>
      {event.activeUntil && (
        <span className="text-xs font-mono shrink-0 opacity-75">
          {formatRemaining(event.activeUntil)}
        </span>
      )}
    </div>
  );
}

/** Displays a banner for each currently active market event. */
export function ActiveEvents() {
  const { data: events } = trpc.public.crypto.activeEvents.useQuery(
    undefined,
    { refetchInterval: 30_000 },
  );

  if (!events?.length) return null;

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <EventBanner key={event.id} event={event} />
      ))}
    </div>
  );
}
