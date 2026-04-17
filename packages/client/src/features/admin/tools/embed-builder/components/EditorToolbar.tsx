import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Send, Save, Copy, Upload } from "lucide-react";
import { useToastActions } from "@/hooks/use-toast";
import { SendModal } from "./SendModal";
import type { UseEmbedBuilder } from "../hooks/use-embed-builder";
import type { EmbedData } from "@createrington/shared/api/embed";

interface EditorToolbarProps {
  builder: UseEmbedBuilder;
}

export function EditorToolbar({ builder }: EditorToolbarProps) {
  const {
    presetName,
    setPresetName,
    activePreset,
    selectedCategoryId,
    setSelectedCategoryId,
    isDirty,
    hasContent,
    isPending,
    categoriesQuery,
    handleSave,
    handleSetPresetCategory,
    data,
    setEmbedData,
  } = builder;

  const toast = useToastActions();
  const [sendOpen, setSendOpen] = useState(false);

  function handleCopyJson() {
    const exportData: EmbedData = {
      ...data,
      fields: data.fields.map((f) => ({
        name: f.name,
        value: f.value,
        inline: f.inline,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    toast.success("Embed JSON copied to clipboard");
  }

  async function handleImportJson() {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text) as EmbedData;

      if (!parsed || typeof parsed !== "object") {
        toast.error("Clipboard does not contain valid JSON");
        return;
      }

      setEmbedData({
        content: parsed.content ?? undefined,
        title: parsed.title ?? undefined,
        description: parsed.description ?? undefined,
        color: parsed.color ?? undefined,
        url: parsed.url ?? undefined,
        footer: parsed.footer ?? undefined,
        author: parsed.author ?? undefined,
        authorUrl: parsed.authorUrl ?? undefined,
        authorIconUrl: parsed.authorIconUrl ?? undefined,
        thumbnailUrl: parsed.thumbnailUrl ?? undefined,
        imageUrl: parsed.imageUrl ?? undefined,
        timestamp: parsed.timestamp ?? false,
        fields: Array.isArray(parsed.fields)
          ? parsed.fields.map((f) => ({
              name: f.name ?? "",
              value: f.value ?? "",
              inline: f.inline ?? false,
            }))
          : [],
        buttons: Array.isArray(parsed.buttons)
          ? parsed.buttons.map((b) => ({
              label: b.label ?? "",
              url: b.url ?? "",
              emoji: b.emoji ?? undefined,
            }))
          : [],
        actionButtons: Array.isArray(parsed.actionButtons)
          ? parsed.actionButtons.map((b) => ({
              label: b.label ?? "",
              action: "create_thread" as const,
              channelId: b.channelId ?? "",
              threadName: b.threadName ?? "",
              threadMessage: b.threadMessage ?? "",
              emoji: b.emoji ?? undefined,
            }))
          : [],
      });

      toast.success("Embed imported from clipboard");
    } catch {
      toast.error(
        "Failed to import — make sure you have valid embed JSON in your clipboard",
      );
    }
  }
  const categories = categoriesQuery.data ?? [];

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

  function handleCategoryChange(value: string) {
    const newCategoryId = value === "none" ? null : Number(value);

    if (activePreset) {
      handleSetPresetCategory(activePreset.id, newCategoryId);
    } else {
      setSelectedCategoryId(newCategoryId);
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Row 1: Name + Category */}
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Label>Preset Name</Label>
            <Input
              placeholder={
                activePreset ? activePreset.name : "Unnamed embed..."
              }
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </div>
          <div className="w-32 shrink-0 space-y-2 sm:w-40">
            <Label>Category</Label>
            <Select
              value={selectedCategoryId?.toString() ?? "none"}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Actions */}
        <div className="flex items-center gap-1">
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCopyJson}
                  disabled={!hasContent}
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground"
                >
                  <Copy className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy as JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleImportJson}
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer text-muted-foreground"
                >
                  <Upload className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Import from clipboard
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="ml-auto flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSave}
                  disabled={saveDisabled}
                  className="shrink-0 cursor-pointer"
                  variant="outline"
                >
                  <Save className="mr-1.5 size-4" />
                  {saveLabel}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {activePreset
                  ? "Save changes to this preset"
                  : "Save as a new preset"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setSendOpen(true)}
                  disabled={!hasContent}
                  className="shrink-0 cursor-pointer"
                >
                  <Send className="mr-1.5 size-4" />
                  Send
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Send embed to a Discord channel
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <SendModal open={sendOpen} onOpenChange={setSendOpen} builder={builder} />
    </>
  );
}
