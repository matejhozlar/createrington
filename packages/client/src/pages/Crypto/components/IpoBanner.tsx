import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket } from "lucide-react";
import { formatPrice, formatCountdown } from "./format";

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
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.03]">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-primary shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">{ipo.name}</span>
              <Badge
                variant="outline"
                className="text-xs text-primary border-primary/30 bg-primary/10"
              >
                IPO LIVE
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {ipo.symbol}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 ml-auto text-sm">
          <div className="text-muted-foreground">
            <span className="text-foreground font-medium font-mono">
              ${formatPrice(ipo.ipoPrice)}
            </span>{" "}
            fixed
          </div>

          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">
              {ipo.participants}
            </span>{" "}
            buyers
          </div>

          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">
              {soldPercent.toFixed(1)}%
            </span>{" "}
            sold
          </div>

          <div className="text-muted-foreground">
            <span className="text-foreground font-mono font-medium">
              {countdown}
            </span>{" "}
            left
          </div>

          <Button
            size="sm"
            onClick={() => navigate(`/crypto/${ipo.symbol}`)}
          >
            Buy Now
          </Button>
        </div>
      </div>
    </div>
  );
}
