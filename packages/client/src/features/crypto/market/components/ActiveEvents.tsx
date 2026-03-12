import { useState, useEffect } from "react";
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

const BULLISH_EVENTS = new Set([
  "bull_run",
  "gold_rush",
  "tax_holiday",
  "new_listing_frenzy",
]);

function useCountdown(activeUntil: string | null): string | null {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!activeUntil) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeUntil]);

  if (!activeUntil) return null;
  return formatCountdown(new Date(activeUntil).getTime() - now);
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
  const isBullish = BULLISH_EVENTS.has(event.type);
  const countdown = useCountdown(event.activeUntil);

  let description = event.description ?? "";
  if (event.tokenSymbol) {
    description = description.replace(/\{token\}/g, event.tokenSymbol);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-2.5",
        isBullish
          ? "border-primary/20 bg-primary/[0.04]"
          : "border-red-500/20 bg-red-500/[0.04]",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isBullish ? "text-primary" : "text-red-400",
        )}
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full animate-pulse shrink-0",
            isBullish ? "bg-primary" : "bg-red-400",
          )}
        />
        <span
          className={cn(
            "font-medium text-sm",
            isBullish ? "text-primary" : "text-red-400",
          )}
        >
          {event.name}
        </span>
        {event.tokenSymbol && (
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
            {event.tokenSymbol}
          </span>
        )}
        {description && (
          <span className="hidden md:inline text-xs text-muted-foreground truncate">
            {description}
          </span>
        )}
      </div>
      {countdown && (
        <span className="text-xs font-mono shrink-0 text-muted-foreground tabular-nums">
          {countdown}
        </span>
      )}
    </div>
  );
}

export function ActiveEvents() {
  const { data: events } = trpc.public.crypto.activeEvents.useQuery();

  if (!events?.length) return null;

  return (
    <div className="space-y-1.5">
      {events.map((event) => (
        <EventBanner key={event.id} event={event} />
      ))}
    </div>
  );
}
