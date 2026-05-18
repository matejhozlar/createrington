import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AtSign, Clock, Hash, Plus, Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatConfigKey as formatName } from "@/features/admin/format";

type Tab = "mentions" | "timestamp";

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
  triggerClassName?: string;
  iconClassName?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

export function InsertMenu({
  onInsert,
  triggerClassName,
  iconClassName,
  tooltipSide = "top",
}: InsertMenuProps) {
  const [open, setOpen] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("mentions");
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

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTooltipOpen(false);
      setTab("mentions");
      setMentionSearch("");
      setTimestampDate(toLocalDatetimeString(new Date()));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip open={tooltipOpen}>
        <TooltipTrigger
          asChild
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "size-5 p-0 text-muted-foreground hover:text-foreground",
                triggerClassName,
              )}
              aria-label="Insert"
            >
              <Plus className={cn("size-3.5", iconClassName)} />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>Insert</TooltipContent>
      </Tooltip>

      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">Insert</DialogTitle>
          <DialogDescription>
            Drop a channel, role, or timestamp at the cursor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 border-b border-border px-3 pt-2">
          <TabButton
            active={tab === "mentions"}
            onClick={() => {
              setMentionSearch("");
              setTab("mentions");
            }}
          >
            <AtSign className="size-3.5" />
            Mentions
          </TabButton>
          <TabButton
            active={tab === "timestamp"}
            onClick={() => setTab("timestamp")}
          >
            <Clock className="size-3.5" />
            Timestamp
          </TabButton>
        </div>

        {tab === "mentions" && (
          <div className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search channels and roles…"
                value={mentionSearch}
                onChange={(e) => setMentionSearch(e.target.value)}
                className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                autoFocus
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto px-2 py-2">
              {!hasMentionResults && (
                <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                  No matches
                </div>
              )}

              {filteredChannelGroups.length > 0 && (
                <>
                  <SectionLabel>
                    <Hash className="size-3" />
                    Channels
                  </SectionLabel>
                  {filteredChannelGroups.map((group) => (
                    <div key={group.category} className="mb-1">
                      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {formatName(group.category)}
                      </div>
                      {group.channels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          className={rowClass}
                          onClick={() => insert(`<#${ch.id}>`)}
                        >
                          <Hash className="size-3.5 text-muted-foreground" />
                          {formatName(ch.name)}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}

              {filteredChannelGroups.length > 0 && filteredRoles.length > 0 && (
                <div className="my-2 border-t border-border" />
              )}

              {filteredRoles.length > 0 && (
                <>
                  <SectionLabel>
                    <Shield className="size-3" />
                    Roles
                  </SectionLabel>
                  {filteredRoles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      className={rowClass}
                      onClick={() => insert(`<@&${role.id}>`)}
                    >
                      <AtSign className="size-3.5 text-muted-foreground" />
                      {formatName(role.name)}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {tab === "timestamp" && (
          <div className="flex flex-col">
            <div className="border-b border-border px-5 py-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Date and time
              </label>
              <input
                type="datetime-local"
                value={timestampDate}
                onChange={(e) => setTimestampDate(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              <SectionLabel>Format</SectionLabel>
              {TIMESTAMP_FORMATS.map(({ label, format, example }) => (
                <button
                  key={format}
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent"
                  onClick={() => insertTimestamp(format)}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {example}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const rowClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-accent";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 text-xs font-medium text-foreground">
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
      )}
    </button>
  );
}
