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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPlayerDetailed } from "@createrington/shared/api";

interface PlayerHeaderProps {
  player: AdminPlayerDetailed;
  isOnline: boolean;
  currentServerName: string | null;
  onNavigateBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlayerHeader({
  player,
  isOnline,
  currentServerName,
  onNavigateBack,
  onEdit,
  onDelete,
}: PlayerHeaderProps) {
  const activeStrikes = player.strikes.activeCount;

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
              <BreadcrumbPage>{player.player.minecraftUsername}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Back Button */}
      <div className="px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateBack}
          className="cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Back to Players
        </Button>
      </div>

      {/* Player Info Card */}
      <div className="mx-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarImage
                src={`https://mc-heads.net/avatar/${player.player.minecraftUuid}`}
                alt={player.player.minecraftUsername}
              />
              <AvatarFallback>
                {player.player.minecraftUsername.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {player.player.minecraftUsername}
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
                Minecraft: {player.player.minecraftUsername}
              </p>
              <p className="text-sm text-muted-foreground">
                Discord: {player.player.discordId}
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
                UUID: {player.player.minecraftUuid}
              </p>
              <p className="text-xs text-muted-foreground">
                Registered:{" "}
                {new Date(player.player.createdAt).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                Last seen:{" "}
                {new Date(player.player.lastSeen).toLocaleDateString()}
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
