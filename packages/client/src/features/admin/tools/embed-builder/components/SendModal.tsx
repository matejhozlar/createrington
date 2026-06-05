import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, RefreshCw } from "lucide-react";
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
            Choose a channel and bot to send the {noun} to Discord.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ChannelSelector value={channelId} onChange={setChannelId} />
          <BotSelector value={bot} onChange={setBot} />

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
              disabled={updateAllPending || !hasContent}
              className="sm:mr-auto"
            >
              <RefreshCw className="mr-1.5 size-4" />
              {updateAllPending ? "Updating..." : "Update All Linked"}
            </Button>
          )}
          <Button
            onClick={onSend}
            disabled={isPending || !hasContent || !channelId}
          >
            <Send className="mr-1.5 size-4" />
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
