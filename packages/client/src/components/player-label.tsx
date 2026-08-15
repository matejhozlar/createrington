import { useState } from "react";
import { Link } from "react-router";
import { Loader2, UserSearch } from "lucide-react";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { useAuth } from "@/contexts/auth";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface PlayerLabelProps {
  uuid?: string | null;
  name?: string | null;
  /**
   * Fallback identifier for the admin link when no UUID is known, e.g. a
   * Discord id. The admin player page resolves any player identifier.
   */
  playerId?: string | null;
  /** Avatar pixel size. Defaults to 24. */
  size?: number;
  /**
   * Whether the label should link to the player detail page. Defaults to
   * true when an identifier is present. Set to false for cases where the
   * player is known by UUID but not resolvable in this app's player DB.
   */
  linkable?: boolean;
}

/**
 * Player label with avatar + username that links to the admin player page
 * for admin viewers. Renders a non-interactive label otherwise.
 *
 * When the caller has no resolved username and falls back to passing the
 * raw UUID as `name`, the label becomes a click-to-resolve button that
 * looks the username up via Mojang on demand.
 */
export function PlayerLabel({
  uuid,
  name,
  playerId,
  size = 24,
  linkable,
}: PlayerLabelProps) {
  const { user } = useAuth();
  const displayName = name ?? uuid ?? "Unknown";
  const isUnresolvedUuid = !!uuid && !!name && name === uuid;
  const linkId = uuid ?? playerId;
  const shouldLink =
    !!user?.isAdmin && (linkable ?? !!linkId) && !!linkId && !isUnresolvedUuid;

  if (!shouldLink) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <MinecraftAvatar
          username={displayName}
          uuid={uuid ?? name ?? undefined}
          size={size}
        />
        {isUnresolvedUuid ? (
          <UnresolvedUuid uuid={uuid} />
        ) : (
          <span className="truncate font-medium">
            {name ?? (
              <span className="italic text-muted-foreground">
                No Minecraft link
              </span>
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <Link
      to={`/admin/players/${linkId}`}
      className="group/player-label flex min-w-0 items-center gap-2 rounded"
    >
      <MinecraftAvatar
        username={displayName}
        uuid={uuid ?? name ?? undefined}
        size={size}
      />
      <span className="truncate font-medium transition-colors group-hover/player-label:text-primary">
        {displayName}
      </span>
    </Link>
  );
}

function UnresolvedUuid({ uuid }: { uuid: string }) {
  const [clicked, setClicked] = useState(false);
  const query = trpc.public.players.resolveUsername.useQuery(
    { uuid },
    { enabled: clicked, staleTime: Infinity },
  );

  if (query.data?.username) {
    return <span className="font-medium">{query.data.username}</span>;
  }

  const lookedUpButEmpty = clicked && query.isSuccess && !query.data?.username;
  const isLoading = query.isFetching;
  const isError = query.isError;

  if (lookedUpButEmpty) {
    return (
      <span className="flex items-center gap-1.5 font-medium italic text-muted-foreground">
        {uuid}
        <span className="text-xs not-italic">(no Mojang profile)</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (clicked && isError) {
          query.refetch();
        } else {
          setClicked(true);
        }
      }}
      disabled={isLoading}
      aria-label={
        isError ? "Retry username lookup" : "Resolve UUID to username"
      }
      className={cn(
        "group/resolve flex items-center gap-1.5 font-medium transition-colors",
        isLoading && "opacity-60",
        isError && "text-destructive hover:text-destructive/80",
        !isLoading && !isError && "text-muted-foreground hover:text-primary",
      )}
    >
      <span>{uuid}</span>
      {isLoading ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <UserSearch className="size-3.5 shrink-0 opacity-70 transition-opacity group-hover/resolve:opacity-100" />
      )}
    </button>
  );
}
