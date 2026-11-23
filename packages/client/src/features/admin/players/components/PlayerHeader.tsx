import { Button } from "@/components/ui/button";
import { PresenceBadge } from "@/components/presence-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AdminPageTitle } from "@/features/admin/components/AdminPageTitle";
import { CellText } from "@/components/cell-text";
import { Edit, Trash2, MapPin } from "lucide-react";
import type { RouterOutput } from "@/lib/trpc";
import { playerPoseUrl } from "@/lib/playerImages";
import { formatDimension, tpCommand } from "@/lib/minecraft";
import { formatDate } from "@createrington/shared/format";

type PlayerDetail =
  RouterOutput["admin"]["players"]["players"]["get"]["player"];

interface PlayerHeaderProps {
  player: PlayerDetail;
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

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex">
        <div className="relative hidden w-36 shrink-0 items-center justify-center border-r border-border py-4 sm:flex">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sidebar-primary/8 via-transparent to-transparent" />
          <img
            src={playerPoseUrl(player.minecraftUuid, "idle")}
            alt={player.minecraftUsername}
            className="relative z-10 h-32 object-contain drop-shadow-md"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <AdminPageTitle
            title={player.minecraftUsername}
            badges={
              <>
                <PresenceBadge
                  status={isOnline ? "online" : "offline"}
                  className="px-1.5 py-0 text-[10px]"
                />
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
              </>
            }
            actions={
              <>
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="size-3.5" />
                  Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            }
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CopyField label="UUID" value={player.minecraftUuid} />
            <CopyField label="Discord" value={player.discordId} />
          </div>

          {!isOnline &&
            player.logoutX != null &&
            player.logoutY != null &&
            player.logoutZ != null && (
              <LogoutPosition
                x={player.logoutX}
                y={player.logoutY}
                z={player.logoutZ}
                dimension={player.logoutDimension}
              />
            )}

          <div className="flex items-center gap-x-3 text-[11px] text-muted-foreground/70">
            <span>Registered {formatDate(player.createdAt)}</span>
            <span>&middot;</span>
            <span>Last seen {formatDate(player.lastSeen)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <CellText
      copy
      value={value}
      display={
        <>
          <span className="text-muted-foreground/60">{label}:</span>{" "}
          <span className="font-mono text-[11px]">{value}</span>
        </>
      }
      className="text-xs text-muted-foreground"
    />
  );
}

function LogoutPosition({
  x,
  y,
  z,
  dimension,
}: {
  x: number;
  y: number;
  z: number;
  dimension: string | null;
}) {
  const tp = tpCommand(dimension ?? "minecraft:overworld", x, y, z);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3" />
        <span>Logout:</span>
        <span className="font-mono text-[11px] text-foreground">
          {x}, {y}, {z}
        </span>
        <span>&middot;</span>
        <span>{formatDimension(dimension)}</span>
      </div>
      <CellText
        copy
        value={tp}
        className="rounded border border-border bg-sidebar-accent/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary/50"
      />
    </div>
  );
}
