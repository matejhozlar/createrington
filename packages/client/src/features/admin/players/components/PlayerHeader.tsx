import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerApiData } from "@createrington/shared/db";
import { mcBodyFront } from "@/lib/external-urls";
import { useToastActions } from "@/hooks/use-toast";

interface PlayerHeaderProps {
  player: PlayerApiData;
  isOnline: boolean;
  currentServerName: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlayerHeader({
  player,
  isOnline,
  currentServerName,
  onEdit,
  onDelete,
}: PlayerHeaderProps) {
  const activeStrikes = 0;
  const toast = useToastActions();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex">
        {/* Full body skin */}
        <div className="relative hidden w-36 shrink-0 items-center justify-center border-r border-border py-4 sm:flex">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sidebar-primary/8 via-transparent to-transparent" />
          <img
            src={mcBodyFront(player.minecraftUuid)}
            alt={player.minecraftUsername}
            className="relative z-10 h-32 object-contain drop-shadow-md"
          />
        </div>

        {/* Info section */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          {/* Row 1: Name + status + actions */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold leading-tight">
                {player.minecraftUsername}
              </h1>
              <Badge
                variant={isOnline ? "default" : "outline"}
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  isOnline &&
                    "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                )}
              >
                {isOnline ? "Online" : "Offline"}
              </Badge>
              {isOnline && currentServerName && (
                <span className="text-xs text-muted-foreground">
                  on{" "}
                  <span className="font-medium text-foreground">
                    {currentServerName}
                  </span>
                </span>
              )}
              {activeStrikes > 0 && (
                <Badge
                  variant="destructive"
                  className="text-[10px] px-1.5 py-0"
                >
                  {activeStrikes} Strike{activeStrikes > 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="cursor-pointer"
              >
                <Edit className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                className="cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>

          {/* Row 2: Copyable identifiers */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CopyField
              label="UUID"
              value={player.minecraftUuid}
              onCopy={() => copyToClipboard(player.minecraftUuid, "UUID")}
            />
            <CopyField
              label="Discord"
              value={player.discordId}
              onCopy={() => copyToClipboard(player.discordId, "Discord ID")}
            />
          </div>

          {/* Row 3: Dates */}
          <div className="flex items-center gap-x-3 text-[11px] text-muted-foreground/70">
            <span>
              Registered{" "}
              {new Date(player.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>&middot;</span>
            <span>
              Last seen{" "}
              {new Date(player.lastSeen).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span className="text-muted-foreground/60">{label}:</span>
      <span className="font-mono text-[11px]">{value}</span>
      <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
