import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerApiData } from "@createrington/shared/db";
import { MinecraftAvatar } from "@/components/minecraft-avatar";

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

  return (
    <>
      {/* Breadcrumb Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-sidebar px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/dashboard">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/players">Players</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{player.minecraftUsername}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Player Info Card */}
      <div className="mx-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <MinecraftAvatar
              uuid={player.minecraftUuid}
              username={player.minecraftUsername}
            />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {player.minecraftUsername}
                </h1>
                <Badge
                  variant={isOnline ? "default" : "outline"}
                  className={cn(
                    isOnline &&
                      "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                  )}
                >
                  {isOnline ? "Online" : "Offline"}
                </Badge>
                {activeStrikes > 0 && (
                  <Badge variant="destructive">
                    {activeStrikes} Active Strike{activeStrikes > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Minecraft: {player.minecraftUsername}
              </p>
              <p className="text-sm text-muted-foreground">
                Discord: {player.discordId}
              </p>
              {isOnline && currentServerName && (
                <p className="text-sm text-muted-foreground">
                  Playing on:{" "}
                  <span className="font-medium text-foreground">
                    {currentServerName}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                UUID: {player.minecraftUuid}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered: {new Date(player.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Last seen: {new Date(player.lastSeen).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="min-w-[85px] cursor-pointer"
            >
              <Edit className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="min-w-[85px] cursor-pointer"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
