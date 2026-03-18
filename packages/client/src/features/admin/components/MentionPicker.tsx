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
import { AtSign, Hash, Shield } from "lucide-react";
import { useState } from "react";
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

  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const rolesQuery = trpc.admin.embeds.roles.useQuery();

  const channelGroups = channelsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) setTooltipOpen(false); }}>
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
              className="size-7 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
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
        className="max-h-64 w-56 overflow-y-auto"
      >
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
          <Hash className="size-3" />
          Channels
        </DropdownMenuLabel>
        {channelGroups.map((group) => (
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

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
          <Shield className="size-3" />
          Roles
        </DropdownMenuLabel>
        {roles.map((role) => (
          <DropdownMenuItem
            key={role.id}
            onClick={() => onInsert(`<@&${role.id}>`)}
            className="cursor-pointer text-xs"
          >
            <AtSign className="mr-1.5 size-3 text-muted-foreground" />
            {formatName(role.name)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
