import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { formatPrice, formatCountdown } from "../../format";

export function IpoBanner() {
  const navigate = useNavigate();
  const { data: ipo, isLoading } = trpc.public.crypto.activeIpo.useQuery(
    undefined,
    { refetchInterval: 10_000 },
  );

  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!ipo) return;

    const update = () => {
      const remaining = new Date(ipo.ipoEndsAt).getTime() - Date.now();
      setCountdown(formatCountdown(remaining));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [ipo]);

  if (isLoading || !ipo) return null;

  const soldPercent = (Number(ipo.totalSold) / Number(ipo.totalSupply)) * 100;

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04]">
      <div className="absolute -right-20 -top-20 size-48 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Token info */}
          <div className="flex items-center gap-3">
            <Rocket className="size-5 text-primary shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{ipo.name}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  IPO Live
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {ipo.symbol}
              </span>
            </div>
          </div>

          {/* Stats + CTA */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <IpoStat label="Price" value={`$${formatPrice(ipo.ipoPrice)}`} highlight />
            <IpoStat label="Buyers" value={String(ipo.participants)} />
            <IpoStat label="Sold" value={`${soldPercent.toFixed(1)}%`} />
            <IpoStat label="Remaining" value={countdown} mono />
            <Button
              size="sm"
              onClick={() => navigate(`/crypto/${ipo.symbol}`)}
            >
              Buy Now
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-primary/60 transition-all duration-500"
            style={{ width: `${Math.min(soldPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function IpoStat({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-bold ${mono ? "font-mono" : ""} ${highlight ? "text-primary" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
