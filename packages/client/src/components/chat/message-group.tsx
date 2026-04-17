import type { MessageSource as MessageSourceType } from "@createrington/shared/socket";
import { MessageSource } from "@createrington/shared/socket";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { SourceBadge } from "./source-badge";
import { MessageRow } from "./message-row";
import { SOURCE_CONFIG } from "./constants";
import type { MessageGroup } from "./types";
import { formatTime } from "./utils";

export function MessageGroupComponent({
  group,
  prevSource,
  tick,
  onImageLoad,
  isOnline,
  hasHighlight,
  onHighlightEnd,
}: {
  group: MessageGroup;
  prevSource?: MessageSourceType;
  tick: number;
  onImageLoad?: () => void;
  isOnline?: boolean;
  hasHighlight: boolean;
  onHighlightEnd?: (messageIds: string[]) => void;
}) {
  const config = SOURCE_CONFIG[group.source];
  const showDivider = prevSource !== undefined && prevSource !== group.source;

  return (
    <>
      {showDivider && (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className={cn("h-px flex-1 bg-border")} />
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border",
              group.source === MessageSource.DISCORD &&
                "border-discord/30 bg-discord/10 text-discord-foreground",
              group.source === MessageSource.MINECRAFT &&
                "border-chart-2/30 bg-chart-2/10 text-chart-2",
              group.source === MessageSource.WEB &&
                "border-chart-3/30 bg-chart-3/10 text-chart-3",
              group.source === MessageSource.SYSTEM &&
                "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
            )}
          >
            {config.label}
          </span>
          <div className={cn("h-px flex-1 bg-border")} />
        </div>
      )}

      <div
        className={cn(
          "group/msg-group relative flex gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-sidebar-accent/20",
          hasHighlight && "animate-new-message",
        )}
        onAnimationEnd={(e) => {
          if (e.animationName === "highlight-bg" && onHighlightEnd) {
            onHighlightEnd(group.messages.map((m) => m.messageId));
          }
        }}
      >
        <div className="shrink-0 pt-0.5">
          <Avatar
            url={group.avatarUrl}
            name={group.displayName}
            isOnline={isOnline}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {group.displayName}
            </span>

            <SourceBadge source={group.source} />

            {group.messages[0]?.isBot &&
              group.source !== MessageSource.MINECRAFT && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.25 text-[10px] font-semibold uppercase tracking-wider",
                    config.bgColor,
                    config.color,
                  )}
                >
                  Bot
                </span>
              )}

            <span className="ml-auto text-[11px] text-muted-foreground/50">
              {formatTime(group.messages[0]?.createdAt)}
            </span>
          </div>

          {group.messages.map((msg, i) => (
            <MessageRow
              key={msg.messageId}
              message={msg}
              isFirst={i === 0}
              tick={tick}
              onImageLoad={onImageLoad}
            />
          ))}
        </div>
      </div>
    </>
  );
}
