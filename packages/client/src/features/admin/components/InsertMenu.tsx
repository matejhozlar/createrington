import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AtSign,
  ArrowLeft,
  Clock,
  Hash,
  Plus,
  Search,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

function formatName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

type Page = "main" | "mentions" | "timestamp";

const TIMESTAMP_FORMATS = [
  { label: "Short Time", format: "t", example: "4:20 PM" },
  { label: "Long Time", format: "T", example: "4:20:30 PM" },
  { label: "Short Date", format: "d", example: "03/25/2026" },
  { label: "Long Date", format: "D", example: "March 25, 2026" },
  { label: "Short Date/Time", format: "f", example: "March 25, 2026 4:20 PM" },
  {
    label: "Long Date/Time",
    format: "F",
    example: "Wednesday, March 25, 2026 4:20 PM",
  },
  { label: "Relative", format: "R", example: "in 5 minutes" },
] as const;

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface InsertMenuProps {
  onInsert: (text: string) => void;
}

export function InsertMenu({ onInsert }: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [page, setPage] = useState<Page>("main");
  const [mentionSearch, setMentionSearch] = useState("");
  const [timestampDate, setTimestampDate] = useState(
    toLocalDatetimeString(new Date()),
  );

  const channelsQuery = trpc.admin.embeds.channels.useQuery();
  const rolesQuery = trpc.admin.embeds.roles.useQuery();

  const query = mentionSearch.toLowerCase();

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

  const hasMentionResults =
    filteredChannelGroups.length > 0 || filteredRoles.length > 0;

  function insert(text: string) {
    onInsert(text);
    setOpen(false);
  }

  function insertTimestamp(format: string) {
    const date = new Date(timestampDate);
    if (isNaN(date.getTime())) return;
    const unix = Math.floor(date.getTime() / 1000);
    insert(`<t:${unix}:${format}>`);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTooltipOpen(false);
    }
    if (!nextOpen) {
      setPage("main");
      setMentionSearch("");
      setTimestampDate(toLocalDatetimeString(new Date()));
    }
  }

  const menuItemClass =
    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip open={tooltipOpen}>
        <TooltipTrigger
          asChild
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-5 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
              aria-label="Insert"
            >
              <Plus className="size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">Insert</TooltipContent>
      </Tooltip>

      <PopoverContent align="start" className="w-56 p-1" sideOffset={4}>
        {page === "main" && (
          <div className="flex flex-col">
            <button
              type="button"
              className={menuItemClass}
              onClick={() => setPage("mentions")}
            >
              <AtSign className="size-3.5 text-muted-foreground" />
              Mention
            </button>
            <button
              type="button"
              className={menuItemClass}
              onClick={() => setPage("timestamp")}
            >
              <Clock className="size-3.5 text-muted-foreground" />
              Timestamp
            </button>
          </div>
        )}

        {page === "mentions" && (
          <div className="flex flex-col">
            <button
              type="button"
              className="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => {
                setPage("main");
                setMentionSearch("");
              }}
            >
              <ArrowLeft className="size-3" />
              Back
            </button>

            <div className="flex items-center gap-1.5 border-b border-border px-2 pb-1.5">
              <Search className="size-3 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={mentionSearch}
                onChange={(e) => setMentionSearch(e.target.value)}
                className="h-7 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto">
              {!hasMentionResults && (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  No results
                </div>
              )}

              {filteredChannelGroups.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium">
                    <Hash className="size-3" />
                    Channels
                  </div>
                  {filteredChannelGroups.map((group) => (
                    <div key={group.category}>
                      <div className="px-2 pt-1.5 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatName(group.category)}
                      </div>
                      {group.channels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          className={menuItemClass}
                          onClick={() => insert(`<#${ch.id}>`)}
                        >
                          <Hash className="size-3 text-muted-foreground" />
                          {formatName(ch.name)}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {filteredChannelGroups.length > 0 &&
                filteredRoles.length > 0 && (
                  <div className="my-1 border-t border-border" />
                )}

              {filteredRoles.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium">
                    <Shield className="size-3" />
                    Roles
                  </div>
                  {filteredRoles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={menuItemClass}
                      onClick={() => insert(`<@&${role.id}>`)}
                    >
                      <AtSign className="size-3 text-muted-foreground" />
                      {formatName(role.name)}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {page === "timestamp" && (
          <div className="flex flex-col">
            <button
              type="button"
              className="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setPage("main")}
            >
              <ArrowLeft className="size-3" />
              Back
            </button>

            <div className="border-b border-border px-2 pb-2">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                Date & Time
              </label>
              <input
                type="datetime-local"
                value={timestampDate}
                onChange={(e) => setTimestampDate(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-xs text-foreground outline-none focus:border-ring [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>

            <div className="py-1">
              <div className="px-2 pt-1 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Format
              </div>
              {TIMESTAMP_FORMATS.map(({ label, format, example }) => (
                <button
                  key={format}
                  type="button"
                  className="flex w-full cursor-pointer items-start flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  onClick={() => insertTimestamp(format)}
                >
                  <span className="text-left text-xs">{label}</span>
                  <span className="text-left text-[10px] text-muted-foreground">
                    {example}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
