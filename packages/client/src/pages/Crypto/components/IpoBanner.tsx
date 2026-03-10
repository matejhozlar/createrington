import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, Clock, Users, Coins } from "lucide-react";

/** Formats remaining time as "Xh Ym" or "Ym Zs" */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Formats a price value with adaptive decimal precision based on magnitude. */
function formatPrice(price: string | number): string {
  const num = Number(price);
  if (num === 0) return "$0.00";
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  if (num < 1000) return `$${num.toFixed(2)}`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Shows a prominent banner when there's an active IPO. */
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
    <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
      <CardContent className="flex items-center gap-6 p-4">
        <div className="flex items-center gap-2">
          <Rocket className="h-6 w-6 text-amber-400 animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{ipo.name}</span>
              <Badge
                variant="outline"
                className="text-xs text-amber-400 border-amber-500/20 bg-amber-500/10"
              >
                IPO LIVE
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {ipo.symbol}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6 ml-auto text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span>
              <span className="text-foreground font-medium">
                {formatPrice(ipo.ipoPrice)}
              </span>{" "}
              fixed
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              <span className="text-foreground font-medium">
                {ipo.participants}
              </span>{" "}
              buyers
            </span>
          </div>

          <div className="text-muted-foreground">
            <span className="text-foreground font-medium">
              {soldPercent.toFixed(1)}%
            </span>{" "}
            sold
          </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-foreground font-mono font-medium">
              {countdown}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => navigate(`/crypto/${ipo.symbol}`)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-medium"
          >
            Buy Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
