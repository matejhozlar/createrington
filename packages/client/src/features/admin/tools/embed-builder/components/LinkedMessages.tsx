import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link2, RefreshCw, Unlink } from "lucide-react";
import { camelCaseToTitle } from "@/lib/format";
import { queryClient, trpc } from "@/lib/trpc";
import { useMutationToast } from "@/hooks/use-mutation-toast";
import type { EmbedBot, MessagePayload } from "@createrington/shared/api/embed";

interface LinkedMessagesProps {
  presetId: number;
  payload: MessagePayload;
  bot: EmbedBot;
  validateOrToast: () => boolean;
}

export function LinkedMessages({
  presetId,
  payload,
  bot,
  validateOrToast,
}: LinkedMessagesProps) {
  const linksQuery = useQuery(
    trpc.admin.embeds.presets.links.list.queryOptions({ presetId }),
  );
  const channelsQuery = useQuery(trpc.admin.embeds.channels.queryOptions());
  const channelNames = useMemo(
    () =>
      new Map(
        (channelsQuery.data ?? []).flatMap((group) =>
          group.channels.map((ch) => [ch.id, ch.name] as const),
        ),
      ),
    [channelsQuery.data],
  );

  const updateLink = useMutation(
    trpc.admin.embeds.presets.links.update.mutationOptions(
      useMutationToast({ success: "Linked message updated" }),
    ),
  );
  const unlink = useMutation(
    trpc.admin.embeds.presets.links.delete.mutationOptions(
      useMutationToast({
        success: "Message unlinked",
        onSuccess: () =>
          void queryClient.invalidateQueries(
            trpc.admin.embeds.presets.links.list.pathFilter(),
          ),
      }),
    ),
  );

  const [unlinkTarget, setUnlinkTarget] = useState<{
    id: number;
    channelName: string | null;
  } | null>(null);

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
          const channelName = channelNames.get(link.channelId);
          return (
            <div
              key={link.id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
            >
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {channelName ? (
                  <>
                    <span className="font-medium text-foreground">
                      #{camelCaseToTitle(channelName)}
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
                      className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-foreground pointer-coarse:size-9"
                      disabled={updateLink.isPending}
                      onClick={() => {
                        if (validateOrToast()) {
                          updateLink.mutate({
                            linkId: link.id,
                            bot,
                            ...payload,
                          });
                        }
                      }}
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
                      className="size-6 cursor-pointer p-0 text-muted-foreground hover:text-destructive pointer-coarse:size-9"
                      onClick={() =>
                        setUnlinkTarget({
                          id: link.id,
                          channelName: channelName ?? null,
                        })
                      }
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

      <ConfirmDialog
        open={!!unlinkTarget}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null);
        }}
        size="sm"
        variant="destructive"
        title="Unlink this message?"
        description={
          <>
            The message in Discord will stay where it is, but it won't be
            updated when you save changes to this preset.
            {unlinkTarget?.channelName ? (
              <>
                {" "}
                Currently linked in{" "}
                <span className="font-medium text-foreground">
                  #{camelCaseToTitle(unlinkTarget.channelName)}
                </span>
                .
              </>
            ) : null}
          </>
        }
        confirmLabel="Unlink"
        onConfirm={() =>
          unlinkTarget ? unlink.mutateAsync({ id: unlinkTarget.id }) : undefined
        }
      />
    </div>
  );
}
