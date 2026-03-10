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
import { formatCountdown } from "../../format";

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

const EVENT_STYLES: Record<
  string,
  { border: string; bg: string; text: string; iconBg: string; dot: string }
> = {
  bull_run: { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.06]", text: "text-emerald-400", iconBg: "bg-emerald-500/15", dot: "bg-emerald-400" },
  bear_market: { border: "border-red-500/30", bg: "bg-red-500/[0.06]", text: "text-red-400", iconBg: "bg-red-500/15", dot: "bg-red-400" },
  flash_crash: { border: "border-red-500/30", bg: "bg-red-500/[0.06]", text: "text-red-400", iconBg: "bg-red-500/15", dot: "bg-red-400" },
  pump_and_dump: { border: "border-yellow-500/30", bg: "bg-yellow-500/[0.06]", text: "text-yellow-400", iconBg: "bg-yellow-500/15", dot: "bg-yellow-400" },
  liquidity_drought: { border: "border-orange-500/30", bg: "bg-orange-500/[0.06]", text: "text-orange-400", iconBg: "bg-orange-500/15", dot: "bg-orange-400" },
  gold_rush: { border: "border-yellow-500/30", bg: "bg-yellow-500/[0.06]", text: "text-yellow-400", iconBg: "bg-yellow-500/15", dot: "bg-yellow-400" },
  supply_shock: { border: "border-orange-500/30", bg: "bg-orange-500/[0.06]", text: "text-orange-400", iconBg: "bg-orange-500/15", dot: "bg-orange-400" },
  tax_holiday: { border: "border-emerald-500/30", bg: "bg-emerald-500/[0.06]", text: "text-emerald-400", iconBg: "bg-emerald-500/15", dot: "bg-emerald-400" },
  whale_dump: { border: "border-red-500/30", bg: "bg-red-500/[0.06]", text: "text-red-400", iconBg: "bg-red-500/15", dot: "bg-red-400" },
  new_listing_frenzy: { border: "border-blue-500/30", bg: "bg-blue-500/[0.06]", text: "text-blue-400", iconBg: "bg-blue-500/15", dot: "bg-blue-400" },
};

const DEFAULT_STYLE = {
  border: "border-blue-500/30",
  bg: "bg-blue-500/[0.06]",
  text: "text-blue-400",
  iconBg: "bg-blue-500/15",
  dot: "bg-blue-400",
};

function formatRemaining(activeUntil: string): string {
  const remaining = new Date(activeUntil).getTime() - Date.now();
  return formatCountdown(remaining);
}

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
  const style = EVENT_STYLES[event.type] ?? DEFAULT_STYLE;

  let description = event.description ?? "";
  if (event.tokenSymbol) {
    description = description.replace(/\{token\}/g, event.tokenSymbol);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-xl border px-4 py-3.5 animate-in fade-in slide-in-from-top-2 duration-300",
        style.border,
        style.bg,
      )}
    >
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          style.iconBg,
        )}
      >
        <Icon className={cn("size-4", style.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full animate-pulse", style.dot)} />
          <span className={cn("font-semibold text-sm", style.text)}>
            {event.name}
          </span>
          {event.tokenSymbol && (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {event.tokenSymbol}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {description}
          </p>
        )}
      </div>
      {event.activeUntil && (
        <span className="text-xs font-mono shrink-0 text-muted-foreground tabular-nums">
          {formatRemaining(event.activeUntil)}
        </span>
      )}
    </div>
  );
}

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
