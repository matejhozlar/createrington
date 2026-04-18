import { useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { mcHeadsAvatar } from "@/lib/external-urls";
import { usePlayerData } from "@/contexts/player-data";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRelativeTick } from "./hooks";
import { formatDuration } from "./utils";

/**
 * A single row in the player list panel.
 * Re-renders every tick so the session duration stays live.
 */
function PlayerRow({
  uuid,
  username,
  sessionStart,
  now,
  isCollapsed,
}: {
  uuid: string;
  username: string;
  sessionStart: Date | string;
  /** Current timestamp snapshot from the parent's tick — pure state, no Date.now() here */
  now: number;
  /** True when the sidebar is in icon-collapsed mode */
  isCollapsed: boolean;
}) {
  const avatarUrl = mcHeadsAvatar(uuid);
  const [broken, setBroken] = useState(false);

  const start =
    sessionStart instanceof Date
      ? sessionStart.getTime()
      : new Date(sessionStart).getTime();
  const sessionMs = now - start;

  const initials = username.charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "flex items-center transition-colors duration-150 hover:bg-sidebar-accent/30",
        isCollapsed ? "justify-center px-0 py-2" : "gap-3 px-4 py-2.5",
      )}
    >
      {/*
       * Avatar — when collapsed we wrap it in the same Tooltip pattern that
       * SidebarMenuButton uses: Tooltip > TooltipTrigger asChild > element,
       * with TooltipContent hidden={!isCollapsed} so it's mounted but suppressed
       * in expanded mode.  The TooltipProvider (delayDuration={0}) is already
       * on the tree courtesy of SidebarProvider.
       */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative shrink-0">
            {!broken ? (
              <img
                src={avatarUrl}
                alt={username}
                className="size-9 rounded-full object-cover ring-2 ring-sidebar ring-offset-1 ring-offset-background"
                onError={() => setBroken(true)}
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-chart-2 to-primary text-xs font-semibold text-white ring-2 ring-sidebar ring-offset-1 ring-offset-background">
                {initials}
              </div>
            )}
            {/* Always-green online dot — every player in this list is, by definition, online */}
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-green-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="center" hidden={!isCollapsed}>
          {username}
        </TooltipContent>
      </Tooltip>

      {/* Info — hidden when collapsed */}
      {!isCollapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {username}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            Playing for {formatDuration(sessionMs)}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The slide-over panel itself.  It is rendered as a fixed-position layer that
 * occupies exactly the same space as the sidebar (left: 0, width matches
 * --sidebar-width).  It slides in/out via a CSS translate on the X axis so the
 * transition is GPU-accelerated and buttery.
 *
 * - `open`  : controls the slide state
 * - `onClose`: called when the user clicks the X or presses Escape
 */
export function PlayerListPanel({
  open,
  onClose,
  serverId,
}: {
  open: boolean;
  onClose: () => void;
  serverId: number;
}) {
  const { getServerPlayers } = usePlayerData();
  const { state: sidebarState } = useSidebar();
  const isCollapsed = sidebarState === "collapsed";
  // Tick every 60s so session durations update without remounting
  const now = useRelativeTick(60_000);

  const players = useMemo(
    () => getServerPlayers(serverId),
    [getServerPlayers, serverId],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-[20] flex h-full flex-col overflow-hidden bg-sidebar text-sidebar-foreground",
        "transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "-translate-x-full",
        !open && "pointer-events-none",
      )}
      style={{
        width:
          sidebarState === "collapsed"
            ? "var(--sidebar-width-icon)"
            : "var(--sidebar-width)",
      }}
    >
      {/* Header row */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border",
          isCollapsed
            ? "justify-center px-0 py-3"
            : "justify-between px-4 py-3",
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Online Players
            </h2>
            <span className="inline-flex items-center justify-center rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-semibold text-green-500">
              {players.length}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <X className="size-4 cursor-pointer" />
        </button>
      </div>

      {/* Scrollable player list */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-sidebar-border hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
        {players.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-sidebar-accent">
              <Users className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No players online</p>
          </div>
        ) : (
          <div className="py-2">
            {players.map((player) => (
              <PlayerRow
                key={player.uuid}
                uuid={player.uuid}
                username={player.username}
                sessionStart={player.sessionStart}
                now={now}
                isCollapsed={isCollapsed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
