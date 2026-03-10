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

  const soldPercent =
    (Number(ipo.totalSold) / Number(ipo.totalSupply)) * 100;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/[0.08] via-primary/[0.04] to-emerald-500/[0.06]">
      {/* Glow effects */}
      <div className="absolute -right-20 -top-20 size-48 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      <div className="absolute -left-12 -bottom-12 size-32 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative px-6 py-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Token info */}
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/30">
              <Rocket className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-bold">{ipo.name}</span>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/30">
                  IPO Live
                </span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {ipo.symbol}
              </span>
            </div>
          </div>

          {/* Right: Stats and CTA */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Price
              </p>
              <p className="text-lg font-bold font-mono text-primary">
                ${formatPrice(ipo.ipoPrice)}
              </p>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Buyers
              </p>
              <p className="text-lg font-bold">{ipo.participants}</p>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Sold
              </p>
              <p className="text-lg font-bold">{soldPercent.toFixed(1)}%</p>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Remaining
              </p>
              <p className="text-lg font-bold font-mono">{countdown}</p>
            </div>

            <Button
              onClick={() => navigate(`/crypto/${ipo.symbol}`)}
              className="shrink-0"
            >
              Buy Now
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(soldPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
