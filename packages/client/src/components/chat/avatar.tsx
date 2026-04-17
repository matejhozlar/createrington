import { useState } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  url,
  name,
  isOnline,
}: {
  url?: string;
  name: string;
  isOnline?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative shrink-0">
      {url && !broken ? (
        <img
          src={url}
          alt={name}
          className="size-9 rounded-full object-cover ring-2 ring-sidebar ring-offset-1 ring-offset-background"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-4 text-xs font-semibold text-white ring-2 ring-sidebar ring-offset-1 ring-offset-background">
          {initials}
        </div>
      )}

      {isOnline !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
            isOnline ? "bg-green-500" : "bg-destructive",
          )}
        />
      )}
    </div>
  );
}
