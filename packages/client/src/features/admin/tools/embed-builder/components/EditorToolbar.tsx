import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, Save, RefreshCw } from "lucide-react";
import { ChannelSelector } from "./ChannelSelector";
import { BotSelector } from "./BotSelector";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";

interface EditorToolbarProps {
  builder: UseEmbedBuilder;
}

export function EditorToolbar({ builder }: EditorToolbarProps) {
  const {
    presetName,
    setPresetName,
    channelId,
    setChannelId,
    bot,
    setBot,
    activePreset,
    isDirty,
    hasContent,
    isPending,
    linksQuery,
    handleSend,
    handleSave,
    handleUpdateAll,
    updateAllPending,
  } = builder;

  const hasLinks = (linksQuery.data?.links.length ?? 0) > 0;

  const saveDisabled = activePreset
    ? isPending || !isDirty
    : isPending || !presetName.trim();

  const saveLabel = activePreset
    ? isPending
      ? "Saving..."
      : "Save"
    : isPending
      ? "Creating..."
      : "Save as New";

  return (
    <div className="space-y-3">
      {/* Row 1: Preset name + Save */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <Label>Preset Name</Label>
          <Input
            placeholder={activePreset ? activePreset.name : "Unnamed embed..."}
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={saveDisabled}
          className="shrink-0 cursor-pointer"
          variant="outline"
        >
          <Save className="mr-1.5 size-4" />
          {saveLabel}
        </Button>
      </div>

      {/* Row 2: Channel + Bot + Send + Update All */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <ChannelSelector value={channelId} onChange={setChannelId} />
        </div>
        <div className="w-44">
          <BotSelector value={bot} onChange={setBot} />
        </div>
        <Button
          onClick={handleSend}
          disabled={isPending || !hasContent || !channelId}
          className="shrink-0 cursor-pointer"
        >
          <Send className="mr-1.5 size-4" />
          {isPending ? "Sending..." : "Send"}
        </Button>
        {activePreset && hasLinks && (
          <Button
            variant="outline"
            onClick={handleUpdateAll}
            disabled={updateAllPending || !hasContent}
            className="shrink-0 cursor-pointer"
          >
            <RefreshCw className="mr-1.5 size-4" />
            {updateAllPending ? "Updating..." : "Update All"}
          </Button>
        )}
      </div>
    </div>
  );
}
