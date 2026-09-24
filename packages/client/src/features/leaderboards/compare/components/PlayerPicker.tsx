import { useState, type ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/auth";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";

const RIVALS = 6;
const RIVAL_PAGE = RIVALS + 1;
const RESULTS = 8;

interface PickablePlayer {
  minecraftUuid: string;
  minecraftUsername: string;
  note: string;
}

function PlayerItem({
  player,
  onPick,
}: {
  player: PickablePlayer;
  onPick: (minecraftUsername: string) => void;
}) {
  return (
    <CommandItem
      value={player.minecraftUuid}
      onSelect={() => onPick(player.minecraftUsername)}
      className="cursor-pointer gap-3"
    >
      <MinecraftAvatar
        username={player.minecraftUsername}
        uuid={player.minecraftUuid}
        size={24}
      />
      <span className="min-w-0 flex-1 truncate font-medium">
        {player.minecraftUsername}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {player.note}
      </span>
    </CommandItem>
  );
}

function PlayerResults({
  exclude,
  rivalRank,
  onPick,
}: {
  exclude: (string | null)[];
  rivalRank: number | null;
  onPick: (minecraftUsername: string) => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), 200);
  const searching = debounced.length > 0;

  const searchQuery = trpc.public.leaderboards.list.useQuery(
    { board: "playtime", search: debounced, limit: RESULTS },
    {
      enabled: searching,
      staleTime: 60 * 1000,
      placeholderData: (previous) => previous,
    },
  );
  const rivalsQuery = trpc.public.leaderboards.list.useQuery(
    {
      board: "playtime",
      page: rivalRank ? Math.floor((rivalRank - 1) / RIVAL_PAGE) : 0,
      limit: RIVAL_PAGE,
    },
    { enabled: !searching, staleTime: 60 * 1000 },
  );

  const excluded = exclude.map((name) => name?.toLowerCase());
  const available = (minecraftUsername: string) =>
    !excluded.includes(minecraftUsername.toLowerCase());
  const asPickable = (rows: typeof searchQuery.data) =>
    (rows?.rows ?? [])
      .filter((row) => available(row.minecraftUsername))
      .map((row) => ({ ...row, note: `#${row.rank} Playtime` }));
  const you =
    user && available(user.minecraftUsername)
      ? {
          minecraftUuid: user.minecraftUuid,
          minecraftUsername: user.minecraftUsername,
          note: "You",
        }
      : null;

  const groups: { heading: string; players: PickablePlayer[] }[] = searching
    ? [{ heading: "Players", players: asPickable(searchQuery.data) }]
    : [
        { heading: "You", players: you ? [you] : [] },
        {
          heading: rivalRank ? "Closest rivals" : "Top players",
          players: asPickable(rivalsQuery.data)
            .filter((row) => row.minecraftUuid !== you?.minecraftUuid)
            .slice(0, RIVALS),
        },
      ];
  const loading = searching ? searchQuery.isLoading : rivalsQuery.isLoading;

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex justify-center py-6">
        <Spinner className="size-4 text-muted-foreground" />
      </div>
    );
  } else {
    body = (
      <>
        <CommandEmpty>No player matching "{debounced}".</CommandEmpty>
        {groups
          .filter((group) => group.players.length > 0)
          .map((group) => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.players.map((player) => (
                <PlayerItem
                  key={player.minecraftUuid}
                  player={player}
                  onPick={onPick}
                />
              ))}
            </CommandGroup>
          ))}
      </>
    );
  }

  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search players"
      />
      <CommandList>{body}</CommandList>
    </Command>
  );
}

export function PlayerPicker({
  open,
  onOpenChange,
  exclude,
  rivalRank,
  align,
  onPick,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exclude: (string | null)[];
  rivalRank: number | null;
  align: "start" | "end";
  onPick: (minecraftUsername: string) => void;
  children: ReactNode;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-[min(20rem,calc(100vw-2rem))] p-0"
      >
        <PlayerResults
          exclude={exclude}
          rivalRank={rivalRank}
          onPick={(minecraftUsername) => {
            onPick(minecraftUsername);
            onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
