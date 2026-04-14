import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AtSign, Hash, Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

interface MentionPickerProps {
  onInsert: (mention: string) => void;
}

export function MentionPicker({ onInsert }: MentionPickerProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [search, setSearch] = useState("");

  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const rolesQuery = trpc.admin.embeds.roles.useQuery();

  const query = search.toLowerCase();

  const filteredChannelGroups = useMemo(() => {
    const groups = channelsQuery.data ?? [];
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        channels: group.channels.filter((ch) =>
          formatName(ch.name).toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.channels.length > 0);
  }, [channelsQuery.data, query]);

  const filteredRoles = useMemo(() => {
    const allRoles = rolesQuery.data ?? [];
    if (!query) return allRoles;
    return allRoles.filter((role) =>
      formatName(role.name).toLowerCase().includes(query),
    );
  }, [rolesQuery.data, query]);

  const hasResults =
    filteredChannelGroups.length > 0 || filteredRoles.length > 0;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) setTooltipOpen(false);
        if (!open) setSearch("");
      }}
    >
      <Tooltip open={tooltipOpen}>
        <TooltipTrigger
          asChild
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Insert mention"
            >
              <AtSign className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Insert mention</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        className="max-h-72 w-56 overflow-y-auto"
      >
        {/* Search input */}
        <div className="flex items-center gap-1.5 border-b border-border px-2 pb-1.5">
          <Search className="size-3 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {!hasResults && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            No results
          </div>
        )}

        {filteredChannelGroups.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              <Hash className="size-3" />
              Channels
            </DropdownMenuLabel>
            {filteredChannelGroups.map((group) => (
              <DropdownMenuGroup key={group.category}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {formatName(group.category)}
                </DropdownMenuLabel>
                {group.channels.map((ch) => (
                  <DropdownMenuItem
                    key={ch.id}
                    onClick={() => onInsert(`<#${ch.id}>`)}
                    className="cursor-pointer text-xs"
                  >
                    <Hash className="mr-1.5 size-3 text-muted-foreground" />
                    {formatName(ch.name)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            ))}
          </>
        )}

        {filteredChannelGroups.length > 0 && filteredRoles.length > 0 && (
          <DropdownMenuSeparator />
        )}

        {filteredRoles.length > 0 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              <Shield className="size-3" />
              Roles
            </DropdownMenuLabel>
            {filteredRoles.map((role) => (
              <DropdownMenuItem
                key={role.id}
                onClick={() => onInsert(`<@&${role.id}>`)}
                className="cursor-pointer text-xs"
              >
                <AtSign className="mr-1.5 size-3 text-muted-foreground" />
                {formatName(role.name)}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
