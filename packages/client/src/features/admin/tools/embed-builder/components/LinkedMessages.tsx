import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface LinkedMessagesProps {
  builder: UseEmbedBuilder;
}

function formatChannelName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

export function LinkedMessages({ builder }: LinkedMessagesProps) {
  const {
    linksQuery,
    channelMap,
    handleUpdateLink,
    handleUnlink,
    updateLinkPending,
  } = builder;

  const links = linksQuery.data?.links ?? [];

  if (links.length === 0) return null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Link2 className="size-3" />
        Linked Messages ({links.length})
      </div>
      <div className="space-y-1">
        {links.map((link) => {
          const channelName = channelMap.get(link.channelId);
          return (
            <div
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {channelName ? (
                  <>
                    <span className="font-medium text-foreground">
                      #{formatChannelName(channelName)}
                    </span>
                    {" — "}
                  </>
                ) : null}
                <span className="font-mono">{link.messageId}</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-foreground"
                      disabled={updateLinkPending}
                      onClick={() => handleUpdateLink(link.id)}
                    >
                      <RefreshCw className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Update this message
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleUnlink(link.id)}
                    >
                      <Unlink className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Unlink this message
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
