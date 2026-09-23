import { useEffect, useState } from "react";
import { formatCompactDuration } from "@createrington/shared/format";
import { getSessionSeconds } from "@/lib/session";
import type { PlayerData } from "@createrington/shared/socket";

export function SessionTimer({ player }: { player: PlayerData }) {
  const [seconds, setSeconds] = useState(() => getSessionSeconds(player));

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getSessionSeconds(player));
    }, 1000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <span className="tabular-nums text-muted-foreground text-sm font-mono">
      {formatCompactDuration(seconds)}
    </span>
  );
}
