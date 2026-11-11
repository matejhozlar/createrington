import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import type { GalleryCredit } from "../format";
import { useQuery } from "@tanstack/react-query";

const MAX_CREDITS = 10;
const RESULT_LIMIT = 8;

interface CreditsPickerProps {
  value: GalleryCredit[];
  onChange: (credits: GalleryCredit[]) => void;
  excludeUuid: string;
  disabled?: boolean;
}

export function CreditsPicker({
  value,
  onChange,
  excludeUuid,
  disabled,
}: CreditsPickerProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const searching = debouncedQuery.trim().length > 0;

  const searchQuery = useQuery(
    trpc.public.players.list.queryOptions(
      { minecraftUsername: debouncedQuery, limit: RESULT_LIMIT, page: 0 },
      { enabled: searching },
    ),
  );

  const taken = new Set([excludeUuid, ...value.map((c) => c.minecraftUuid)]);
  const results = (searchQuery.data?.players ?? []).filter(
    (player) => !taken.has(player.minecraftUuid),
  );
  const full = value.length >= MAX_CREDITS;

  const add = (credit: GalleryCredit) => {
    onChange([...value, credit]);
    setQuery("");
  };

  const remove = (uuid: string) => {
    onChange(value.filter((credit) => credit.minecraftUuid !== uuid));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((credit) => (
            <span
              key={credit.minecraftUuid}
              className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 py-1 pl-1.5 pr-1 text-sm"
            >
              <MinecraftAvatar
                username={credit.minecraftUsername}
                uuid={credit.minecraftUuid}
                size={18}
              />
              {credit.minecraftUsername}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                aria-label={`Remove ${credit.minecraftUsername}`}
                disabled={disabled}
                onClick={() => remove(credit.minecraftUuid)}
              >
                <X className="size-3" />
              </Button>
            </span>
          ))}
        </div>
      )}

      <SearchInput
        value={query}
        onValueChange={setQuery}
        placeholder={
          full
            ? `Up to ${MAX_CREDITS} players`
            : "Credit another builder by username"
        }
        disabled={disabled || full}
      >
        {searching && !full && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
            {searchQuery.isLoading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No matching players.
              </div>
            ) : (
              results.map((player) => (
                <button
                  key={player.minecraftUuid}
                  type="button"
                  onClick={() =>
                    add({
                      minecraftUuid: player.minecraftUuid,
                      minecraftUsername: player.minecraftUsername,
                      discordId: null,
                    })
                  }
                  className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <MinecraftAvatar
                    username={player.minecraftUsername}
                    uuid={player.minecraftUuid}
                    size={24}
                  />
                  <span className="text-sm font-medium">
                    {player.minecraftUsername}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </SearchInput>
    </div>
  );
}
