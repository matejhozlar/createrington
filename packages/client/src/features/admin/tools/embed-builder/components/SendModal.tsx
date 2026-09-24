import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, RefreshCw, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { CUSTOM_EMOJI_SOURCE } from "@/lib/discord-emoji";
import { ChannelSelector } from "./ChannelSelector";
import { BotSelector } from "./BotSelector";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface SendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  builder: UseEmbedBuilder;
}

export function SendModal({ open, onOpenChange, builder }: SendModalProps) {
  const {
    kind,
    components,
    externalData,
    channelId,
    setChannelId,
    bot,
    setBot,
    activePreset,
    hasContent,
    isPending,
    linksQuery,
    handleSend,
    handleUpdateAll,
    updateAllPending,
  } = builder;
  const noun = kind === "components" ? "message" : "embed";

  const [linkToPreset, setLinkToPreset] = useState(true);
  const hasLinks = (linksQuery.data?.links.length ?? 0) > 0;

  const emojisQuery = trpc.admin.embeds.emojis.useQuery(undefined, {
    enabled: open && bot !== "main",
  });
  const appEmojiCount = useMemo(() => {
    if (bot === "main" || !emojisQuery.data) return 0;
    const ids = new Set(emojisQuery.data.map((emoji) => emoji.id));
    const payload = JSON.stringify(
      kind === "components" ? components : externalData,
    );
    let count = 0;
    for (const match of payload.matchAll(
      new RegExp(CUSTOM_EMOJI_SOURCE, "g"),
    )) {
      if (ids.has(match[3])) count++;
    }
    return count;
  }, [bot, emojisQuery.data, kind, components, externalData]);

  async function onSend() {
    await handleSend({ linkToPreset });
    onOpenChange(false);
  }

  async function onUpdateAll() {
    await handleUpdateAll();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send {noun}</DialogTitle>
          <DialogDescription>
            Choose where to send the {noun} on Discord.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ChannelSelector value={channelId} onChange={setChannelId} />
          <BotSelector value={bot} onChange={setBot} />

          {appEmojiCount > 0 && (
            <Alert>
              <AlertTriangle />
              <AlertDescription>
                This {noun} uses {appEmojiCount} bot{" "}
                {appEmojiCount === 1 ? "emoji" : "emojis"} that only
                Createrington can send. Discord rejects them on buttons and
                shows raw text elsewhere. Switch the bot to keep them.
              </AlertDescription>
            </Alert>
          )}

          {activePreset && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="link-to-preset"
                checked={linkToPreset}
                onCheckedChange={(checked) => setLinkToPreset(checked === true)}
              />
              <label
                htmlFor="link-to-preset"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Link message to preset (for future updates)
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          {activePreset && hasLinks && (
            <Button
              variant="outline"
              onClick={onUpdateAll}
              disabled={!hasContent}
              loading={updateAllPending}
              className="sm:mr-auto"
            >
              <RefreshCw className="mr-1.5 size-4" />
              Update All Linked
            </Button>
          )}
          <Button
            onClick={onSend}
            disabled={!hasContent || !channelId}
            loading={isPending}
          >
            <Send className="mr-1.5 size-4" />
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
