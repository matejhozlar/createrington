import { useState } from "react";
import { Link } from "react-router-dom";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface PlayerLabelProps {
  uuid?: string | null;
  name?: string | null;
  /** Avatar pixel size. Defaults to 24. */
  size?: number;
  /**
   * Whether the label should link to the player detail page. Defaults to
   * true when `uuid` is present. Set to false for cases where the player is
   * known by UUID but not resolvable in this app's player DB.
   */
  linkable?: boolean;
}

/**
 * Player label with avatar + username that links to `/admin/players/:uuid`
 * when a UUID is available. Renders a non-interactive fallback otherwise.
 *
 * When the caller has no resolved username and falls back to passing the
 * raw UUID as `name`, the label becomes a click-to-resolve button that
 * looks the username up via Mojang on demand.
 */
export function PlayerLabel({
  uuid,
  name,
  size = 24,
  linkable,
}: PlayerLabelProps) {
  const displayName = name ?? uuid ?? "Unknown";
  const isUnresolvedUuid = !!uuid && !!name && name === uuid;
  const shouldLink = (linkable ?? !!uuid) && !!uuid && !isUnresolvedUuid;

  if (!shouldLink) {
    return (
      <div className="flex items-center gap-2">
        <MinecraftAvatar
          username={displayName}
          uuid={uuid ?? undefined}
          size={size}
        />
        {isUnresolvedUuid ? (
          <UnresolvedUuid uuid={uuid} />
        ) : (
          <span className="font-medium">
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
      to={`/admin/players/${uuid}`}
      onClick={(e) => e.stopPropagation()}
      className="group flex items-center gap-2 rounded"
    >
      <MinecraftAvatar
        username={displayName}
        uuid={uuid ?? undefined}
        size={size}
      />
      <span className="font-medium transition-colors group-hover:text-primary">
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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (clicked && query.isError) {
          query.refetch();
        } else {
          setClicked(true);
        }
      }}
      disabled={query.isFetching || lookedUpButEmpty}
      title={
        query.isError
          ? "Lookup failed — click to retry"
          : lookedUpButEmpty
            ? "No Mojang profile for this UUID"
            : "Click to resolve username"
      }
      className={cn(
        "font-mono text-xs font-medium transition-colors",
        query.isFetching && "animate-pulse opacity-60",
        query.isError && "text-destructive hover:text-destructive/80",
        !query.isFetching &&
          !query.isError &&
          !lookedUpButEmpty &&
          "hover:text-amber-500",
        lookedUpButEmpty && "text-muted-foreground",
      )}
    >
      {uuid}
    </button>
  );
}
