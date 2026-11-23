import type { BadgeTone } from "@/components/ui/badge";

export type Presence = "online" | "offline" | "maintenance";

export const PRESENCE_STYLES: Record<
  Presence,
  { label: string; tone?: BadgeTone; tile: string; fill: string }
> = {
  online: {
    label: "Online",
    tone: "success",
    tile: "bg-tone-success/10 text-tone-success",
    fill: "bg-tone-success",
  },
  maintenance: {
    label: "Maintenance",
    tone: "warning",
    tile: "bg-tone-warning/10 text-tone-warning",
    fill: "bg-tone-warning",
  },
  offline: {
    label: "Offline",
    tile: "bg-muted-foreground/10 text-muted-foreground",
    fill: "bg-muted-foreground",
  },
};

export function presenceOf({
  online,
  maintenance,
}: {
  online: boolean;
  maintenance?: boolean | null;
}): Presence {
  if (maintenance) return "maintenance";
  return online ? "online" : "offline";
}
